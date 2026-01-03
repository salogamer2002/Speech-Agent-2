from dotenv import load_dotenv
import chainlit as cl
import re
from chromadb.config import Settings
import chromadb
import numpy as np
from langchain_huggingface import HuggingFaceEmbeddings
from collections import OrderedDict
from typing import Dict, Optional
import requests
import json
import os
import uuid
import openai

load_dotenv()
db = chromadb.PersistentClient(path="./db", settings=Settings(allow_reset=True))
collection_name = "MATZ_Health_Bot"

AUDIO_DIR = "audio_files"
os.makedirs(AUDIO_DIR, exist_ok=True)

user_accepted = {}

# Fireworks AI configuration
FIREWORKS_API_KEY = os.environ.get("FIREWORKS_API_KEY")
FIREWORKS_API_URL = "https://api.fireworks.ai/inference/v1/chat/completions"
# Updated model name - use the one that's available
FIREWORKS_MODEL = "accounts/fireworks/models/kimi-k2-instruct-0905"

# Make OpenAI optional - only for TTS/STT
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
async_openai_client = None

if OPENAI_API_KEY:
    try:
        async_openai_client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY)
        print("✅ OpenAI client initialized - TTS/STT features enabled")
    except Exception as e:
        print(f"⚠️ OpenAI initialization failed: {e}")
        async_openai_client = None
else:
    print("⚠️ OPENAI_API_KEY not found - TTS/STT features will be disabled")

# Fireworks AI helper functions
async def call_fireworks_ai(messages, temperature=0.6, max_tokens=3000, stream=False):
    """Call Fireworks AI API with error handling"""
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {FIREWORKS_API_KEY}"
    }
    
    payload = {
        "model": FIREWORKS_MODEL,
        "max_tokens": max_tokens,
        "top_p": 1,
        "top_k": 40,
        "presence_penalty": 0,
        "frequency_penalty": 0,
        "temperature": temperature,
        "messages": messages,
        "stream": stream
    }
    
    try:
        if stream:
            response = requests.post(FIREWORKS_API_URL, headers=headers, json=payload, stream=True, timeout=30)
            response.raise_for_status()
            return response
        else:
            response = requests.post(FIREWORKS_API_URL, headers=headers, json=payload, timeout=30)
            response.raise_for_status()
            return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Fireworks API request error: {e}")
        return {"error": {"message": str(e), "type": "request_error"}}
    except Exception as e:
        print(f"❌ Unexpected error in API call: {e}")
        return {"error": {"message": str(e), "type": "unknown_error"}}

def call_fireworks_ai_sync(messages, temperature=0.6, max_tokens=3000):
    """Synchronous version for non-async functions with error handling"""
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {FIREWORKS_API_KEY}"
    }
    
    payload = {
        "model": FIREWORKS_MODEL,
        "max_tokens": max_tokens,
        "top_p": 1,
        "top_k": 40,
        "presence_penalty": 0,
        "frequency_penalty": 0,
        "temperature": temperature,
        "messages": messages
    }
    
    try:
        response = requests.post(FIREWORKS_API_URL, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Fireworks API request error: {e}")
        return {"error": {"message": str(e), "type": "request_error"}}
    except Exception as e:
        print(f"❌ Unexpected error in API call: {e}")
        return {"error": {"message": str(e), "type": "unknown_error"}}

@cl.oauth_callback
def oauth_callback(
    provider_id: str,
    token: str,
    raw_user_data: Dict[str, str],
    default_user: cl.User,
) -> Optional[cl.User]:
    """Handle OAuth callback"""
    display_name = raw_user_data.get("name") or raw_user_data.get("email") or default_user.identifier
    email = raw_user_data.get("email", "")
    
    print(f"✅ OAuth login: {display_name} ({email})")
    
    return cl.User(
        identifier=email or default_user.identifier,
        display_name=display_name,
        metadata={
            "role": "user",
            "provider": provider_id,
            "email": email,
            "image": raw_user_data.get("picture", "")
        }
    )

@cl.password_auth_callback
def auth_callback(username: str, password: str):
    """Handle password authentication"""
    users = {
        "user1@test.com": {"password": "admin", "name": "User 1", "role": "admin"},
        "user2@test.com": {"password": "admin", "name": "User 2", "role": "user"},
        "demo@infomary.com": {"password": "demo123", "name": "Demo User", "role": "user"}
    }
    
    if username in users and users[username]["password"] == password:
        print(f"✅ Password login: {users[username]['name']}")
        return cl.User(
            identifier=username,
            display_name=users[username]["name"],
            metadata={
                "role": users[username]["role"],
                "provider": "credentials",
                "email": username
            }
        )
    return None

@cl.on_chat_start
async def setup_health_chatbot():
    """Initialize chat session"""
    global msg
    
    app_user = cl.user_session.get("user")
    session_id = cl.user_session.get("id")
    
    user_email = app_user.metadata.get("email", "")
    user_provider = app_user.metadata.get("provider", "")
    
    print(f"🔵 Chat started - User: {app_user.display_name} | Email: {user_email} | Provider: {user_provider}")
    
    # Initialize session variables
    cl.user_session.set("chat_history", [])
    cl.user_session.set("conversation_history", [])
    cl.user_session.set("question_queue", initialize_question_queue())
    cl.user_session.set("tts", "Disabled")
    
    # Create welcome message
    disclaimer = "⚠️ **Disclaimer:** By using this chatbot, you agree to the terms and conditions.\n\n"
    greeting = f"Hello **{app_user.display_name}**! 👋\n\n"
    intro = "I'm Infomary Health Bot, here to help you with your health concerns. I can assist with:\n"
    intro += "- 🏥 Healthcare Services\n"
    intro += "- 💊 Medical Advice\n"
    intro += "- 🩺 Medical Procedures\n\n"
    intro += "How can I assist you today?"
    
    initial_message = disclaimer + greeting + intro
    
    conversation_history = cl.user_session.get("conversation_history")
    conversation_history.append(f"Assistant: {initial_message}")
    
    await cl.Message(initial_message).send()
    
    # Setup settings if OpenAI is available
    if async_openai_client:
        await cl.ChatSettings(
            [
                cl.input_widget.Select(
                    id="tts_toggle",
                    name="tts_toggle",
                    label="🔊 Read Aloud",
                    values=["Enabled", "Disabled"],
                    initial_index=1,
                    description="Choose whether the assistant should read out responses."
                )
            ]
        ).send()

@cl.on_settings_update
async def setup_agent(settings):
    """Handle settings updates"""
    print(f"⚙️ Settings updated: {settings}")
    cl.user_session.set("tts", settings["tts_toggle"])

@cl.on_chat_resume
async def on_chat_resume(thread: cl.types.ThreadDict):
    """Resume previous chat"""
    app_user = cl.user_session.get("user")
    
    print(f"🔄 Chat resumed - User: {app_user.display_name}")
    
    cl.user_session.set("chat_history", [])
    cl.user_session.set("conversation_history", [])
    conversation_history = cl.user_session.get("conversation_history")
    
    for message in thread["steps"]:
        if message["type"] == "user_message":
            conversation_history.append(f"User: {message['output']}")
            cl.user_session.get("chat_history").append({"role": "user", "content": message["output"]})
        elif message["type"] == "assistant_message":
            conversation_history.append(f"Assistant: {message['output']}")
            cl.user_session.get("chat_history").append({"role": "assistant", "content": message["output"]})

def retrieve_relevant_context(user_query, top_k=1):
    """Retrieve the most relevant context from the Chroma vector store."""
    try:
        embedding_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        query_embedding = embedding_model.embed_query(user_query)

        try:
            chroma_collection = db.get_collection(collection_name)
        except Exception as e:
            print(f"⚠️ Collection not found, creating new collection: {collection_name}")
            chroma_collection = db.create_collection(
                name=collection_name,
                metadata={"description": "Health bot knowledge base"}
            )
            print(f"✅ Collection '{collection_name}' created successfully")
            return []
        
        results = chroma_collection.query(query_embeddings=[query_embedding], n_results=top_k * 2)
        
        if not results['documents'] or not results['documents'][0]:
            print("⚠️ No documents found in collection")
            return []
        
        unique_context = list(OrderedDict.fromkeys(results['documents'][0]))[:top_k]
        return unique_context
    except Exception as e:
        print(f"❌ Error retrieving context: {e}")
        return []

def initialize_question_queue():
    return []

async def generate_follow_up_questions(conversation_history, retrieved_context):
    """Generate follow-up questions using Fireworks AI"""
    prompt = f"""Given the following conversation history:
{chr(10).join(conversation_history)}

Retrieved Context:
{retrieved_context}

Generate 3-5 relevant follow-up questions to better understand the user's health concerns or symptoms. 
Questions should be clear, specific, and help gather important details about symptoms, duration, severity, or related factors."""

    messages = [{"role": "user", "content": prompt}]
    
    try:
        response = await call_fireworks_ai(messages, temperature=0, max_tokens=3000)
        
        # Check for errors
        if 'error' in response:
            print(f"❌ API Error: {response['error']}")
            return []
        
        if 'choices' not in response:
            print(f"❌ Unexpected API response: {response}")
            return []
        
        questions = response['choices'][0]['message']['content'].split('\n')
        return [re.sub(r'\d+\.\s', '', q.strip()) for q in questions if re.sub(r'\d+\.\s', '', q.strip())]
    except Exception as e:
        print(f"❌ Error generating questions: {e}")
        return []

async def validate_question(conversation_history, next_question):
    """Validate if question is relevant using Fireworks AI"""
    prompt = f"""Given the following conversation history:
{chr(10).join(conversation_history)}

Determine if the following question helps in gathering useful information about the user's health. 
Respond with 'yes' if it is relevant, otherwise 'no'.
Question: {next_question}"""

    messages = [{"role": "user", "content": prompt}]
    
    try:
        response = await call_fireworks_ai(messages, temperature=0, max_tokens=3000)
        
        # Check for errors
        if 'error' in response:
            print(f"❌ API Error: {response['error']}")
            return False
        
        if 'choices' not in response:
            print(f"❌ Unexpected API response: {response}")
            return False
        
        return "yes" in response['choices'][0]['message']['content'].lower()
    except Exception as e:
        print(f"❌ Error validating question: {e}")
        return False

def generate_health_advice(conversation_history, retrieved_context):
    """Generate health advice using Fireworks AI"""
    prompt = f"""Based on the following conversation history, provide a concise summary of the user's health concerns 
and offer general advice, including possible conditions and when to seek medical attention:

Chat History:
{chr(10).join(conversation_history)}

Retrieved Context:
{retrieved_context}

Provide advice or next steps:"""

    messages = [{"role": "user", "content": prompt}]
    
    try:
        response = call_fireworks_ai_sync(messages, temperature=0, max_tokens=500)
        
        # Check for errors
        if 'error' in response:
            print(f"❌ API Error: {response['error']}")
            return "I apologize, but I'm having trouble generating advice right now. Please try again."
        
        if 'choices' not in response:
            print(f"❌ Unexpected API response: {response}")
            return "I apologize, but I'm having trouble generating advice right now. Please try again."
        
        return response['choices'][0]['message']['content']
    except Exception as e:
        print(f"❌ Error generating advice: {e}")
        return "I apologize, but I encountered an error. Please try again."

def checkTypeOfRequest(message):
    """Categorize request using Fireworks AI"""
    prompt = f"""Assign category (Healthcare Services, Medical Advice, Medical Procedures) to below mentioned request. Return only the category and no additional text.

###
{message}
###"""

    messages = [{"role": "user", "content": prompt}]
    
    try:
        response = call_fireworks_ai_sync(messages, temperature=0, max_tokens=500)
        
        # Check for errors
        if 'error' in response:
            print(f"❌ API Error: {response['error']}")
            return "Medical Advice"  # Default fallback
        
        # Check if choices exist
        if 'choices' not in response:
            print(f"❌ Unexpected API response: {response}")
            return "Medical Advice"  # Default fallback
        
        return response['choices'][0]['message']['content']
    except Exception as e:
        print(f"❌ Error checking request type: {e}")
        return "Medical Advice"  # Default fallback

@cl.on_message
async def handle_message(message: cl.Message):
    """Handle incoming messages"""
    global msg
    global main_message
    global type_of_request
    type_of_request = ""
    
    chat_history = cl.user_session.get("chat_history")
    session_id = cl.user_session.get("id")
    app_user = cl.user_session.get("user")
    user_message = message.content.lower()
    conversation_history = cl.user_session.get("conversation_history", [])
    question_queue = cl.user_session.get("question_queue", [])

    retrieved_context = retrieve_relevant_context(user_message)

    if type_of_request == "" or len(question_queue) == 0:
        main_message = user_message
        type_of_request = checkTypeOfRequest(user_message)
        print(f"📋 Request Type: {type_of_request}")

    conversation_history.append(f"User: {user_message}")
    chat_history.append({"role": "user", "content": message.content})

    if type_of_request.strip() in ['Healthcare Services', 'Medical Procedures']:
        system_prompt = """
        You are a helpful assistant specialized in senior care. Follow these guidelines:
        - Do not repeat similar details.
        - In your generated responses, focus on topics related to senior care, aging, elder support services, and related resources.
        - When generating responses that include a list of items, avoid repeating similar details in each list item.
        - List only the unique aspects of each item.
        - If multiple items share common attributes, summarize these in a note at the end.
        - Be concise and informative.
        """

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]

        stream_msg = cl.Message(content="")
        await stream_msg.send()

        try:
            response = await call_fireworks_ai(messages, stream=True)
            
            # Check if response is an error dict
            if isinstance(response, dict) and 'error' in response:
                await stream_msg.stream_token("I apologize, but I'm having trouble processing your request. Please try again.")
                await stream_msg.update()
                return
            
            raw_response = ""
            for line in response.iter_lines():
                if line:
                    line_text = line.decode('utf-8')
                    if line_text.startswith('data: '):
                        json_str = line_text[6:]
                        if json_str.strip() == '[DONE]':
                            break
                        try:
                            chunk_data = json.loads(json_str)
                            delta = chunk_data['choices'][0].get('delta', {}).get('content', '')
                            if delta:
                                raw_response += delta
                                await stream_msg.stream_token(delta)
                        except json.JSONDecodeError:
                            continue

            await stream_msg.update()
            msg = stream_msg

            if not raw_response:
                raw_response = "Sorry, I am not trained to answer this query or couldn't find relevant information."

            # Remove duplicates
            unique_responses = []
            seen = set()
            count = 1

            for line in raw_response.split("\n"):
                stripped_line = line.strip()
                match = re.match(r'^(\d+)\.\s*(.*)', stripped_line)
                
                if match:
                    clean_line = match.group(2)
                    if clean_line and clean_line not in seen:
                        seen.add(clean_line)
                        unique_responses.append(f"{count}. {clean_line}")
                        count += 1
                else:
                    if stripped_line and stripped_line not in seen:
                        seen.add(stripped_line)
                        unique_responses.append(f"\n{stripped_line}")

            cleaned_response = "\n".join(unique_responses)

            conversation_history.append(f"Assistant: {cleaned_response}")
            chat_history.append({"role": "assistant", "content": cleaned_response})
            
            await show_and_play_the_message(cleaned_response, session_id)

            type_of_request = ""
            cl.user_session.set("conversation_history", [])
        except Exception as e:
            print(f"❌ Error in message handling: {e}")
            await cl.Message("I apologize, but I encountered an error. Please try again.").send()
    else:
        if not question_queue:
            question_queue = await generate_follow_up_questions(conversation_history, " ".join(retrieved_context))
            cl.user_session.set("question_queue", question_queue)

        next_question = question_queue.pop(0) if question_queue else None

        if next_question:
            is_relevant = await validate_question(conversation_history, next_question)
            if is_relevant:
                conversation_history.append(f"Assistant: {next_question}")
                chat_history.append({"role": "assistant", "content": next_question})
                await show_and_play_the_message(next_question, session_id)
            else:
                await handle_message(message)

        cl.user_session.set("conversation_history", conversation_history)
        cl.user_session.set("question_queue", question_queue)

        if not question_queue:
            health_advice = generate_health_advice(conversation_history, " ".join(retrieved_context))
            await show_and_play_the_message("Here's a summary of your concerns and some advice:\n" + health_advice, session_id)

            print(conversation_history)
            type_of_request = ""
            cl.user_session.set("conversation_history", [])

@cl.step(type="tool", name="Speech to text")
async def speech_to_text(audio_file):
    """Speech-to-text with OpenAI"""
    if not async_openai_client:
        print("⚠️ Speech-to-text is disabled - OPENAI_API_KEY not set")
        return "Speech-to-text is disabled."
    
    try:
        response = await async_openai_client.audio.transcriptions.create(
            model="whisper-1", file=audio_file
        )
        return response.text
    except Exception as e:
        print(f"❌ Speech-to-text error: {e}")
        return "Speech-to-text failed."

async def show_and_play_the_message(text, session_id):
    """Display and optionally play message"""
    global msg
    
    audio_file_path = await text_to_speech(text, session_id)
    await cl.Message(content=text).send()
    
    try:
        await msg.remove()
    except:
        pass
    
    if cl.user_session.get("tts", "Disabled") == "Enabled" and audio_file_path:
        try:
            await msg.remove()
        except:
            pass
        msg = cl.Message("", elements=[cl.Audio(auto_play=True, path=audio_file_path, mime="audio/mpeg", display="inline")])
        await msg.send()

async def text_to_speech(text, session_id):
    """Text-to-speech with OpenAI"""
    if not async_openai_client:
        return None
    
    if cl.user_session.get("tts", "Disabled") == "Enabled":
        try:
            # Clean up old audio files
            for f in os.listdir(AUDIO_DIR):
                if f.endswith(".mp3"):
                    os.remove(os.path.join(AUDIO_DIR, f))

            session_dir = os.path.join(".files", session_id)
            if os.path.exists(session_dir) and os.path.isdir(session_dir):
                for f in os.listdir(session_dir):
                    if f.endswith(".mp3"):
                        os.remove(os.path.join(session_dir, f))

            # Generate TTS
            response = await async_openai_client.audio.speech.create(
                model="tts-1", voice="alloy", input=text
            )
            audio_data = await response.aread()

            filename = f"{uuid.uuid4()}.mp3"
            filepath = os.path.join(AUDIO_DIR, filename)
            with open(filepath, "wb") as f:
                f.write(audio_data)

            return filepath
        except Exception as e:
            print(f"❌ Text-to-speech error: {e}")
            return None
    return None

if __name__ == "__main__":
    from chainlit.cli import run_chainlit
    run_chainlit(__file__)