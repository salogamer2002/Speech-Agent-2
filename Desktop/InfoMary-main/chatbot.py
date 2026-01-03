from langchain_openai import OpenAI
from langchain.chains import LLMChain
from prompts import assistant_prompt, pre_charted_prompt
from langchain.memory.buffer import ConversationBufferMemory

from dotenv import load_dotenv

import chainlit as cl

import json
from datetime import datetime

load_dotenv()

# Function to generate pre-charted note
def generate_pre_charted_note(conversation_history):
    llm = OpenAI(model='gpt-3.5-turbo-instruct',
                 temperature=0,
                 max_tokens=-1)
    llm_chain = LLMChain(llm=llm, prompt=pre_charted_prompt, verbose=True, output_key='pre_charted_note')
    pre_charted_note = llm_chain.run(conversation_history)
    print(pre_charted_note)
    return pre_charted_note


@cl.on_chat_start
async def setup_multiple_chains():
    llm = OpenAI(model='gpt-3.5-turbo-instruct',
                 temperature=0)
    conversation_memory = ConversationBufferMemory(memory_key="chat_history",
                                                   max_len=200,
                                                   return_messages=True,
                                                   )
    llm_chain = LLMChain(llm=llm, prompt=assistant_prompt, memory=conversation_memory)
    cl.user_session.set("llm_chain", llm_chain)
    cl.user_session.set("conversation_history", [])
    conversation_history = cl.user_session.get("conversation_history")

    # Send the initial message to the user
    initial_message = "Hello! I'm here to help pre-chart your information for your upcoming consultation. Could you please tell me briefly about the main reason for your visit today?"
    conversation_history.append(f"Doctor: {initial_message}")
    await cl.Message(initial_message).send()
    

@cl.on_message
async def handle_message(message: cl.Message):
    user_message = message.content.lower()
    llm_chain = cl.user_session.get("llm_chain")
    conversation_history = cl.user_session.get("conversation_history")

    # print(user_message)
    prompt_input = {
        "chat_history": "\n".join(conversation_history),
        "question": user_message
    }

    # Check if the user wants to exit
    if user_message == "exit":
        await cl.Message("Goodbye!").send()  # Optional: send a goodbye message
        pre_charted_note = generate_pre_charted_note(conversation_history)
        await cl.Message(pre_charted_note).send()
        data = {
            "conversation": conversation_history,
            "pre_charted_note": pre_charted_note
        }
        with open(r'F:\Systems Ltd\data_science\Pre-Charted Note Generation\conversation_history\{date:%Y_%m_%d %H_%M_%S}.json'.format( date=datetime.now()), 'w') as f:
            json.dump(data, f)

        quit()
    
    # Add user message to conversation history
    conversation_history.append(f"Patient: {user_message}")

    # Default to llm_chain for handling general queries
    response = await llm_chain.acall(prompt_input,
                                        callbacks=[cl.AsyncLangchainCallbackHandler()])

    # Add chatbot response to conversation history
    chatbot_response = response.get("output") if "output" in response else response.get("text", "")
    conversation_history.append(f"Doctor: {chatbot_response}")
    
    await cl.Message(chatbot_response).send()
    cl.user_session.set("conversation_history", conversation_history)  # Update the conversation history