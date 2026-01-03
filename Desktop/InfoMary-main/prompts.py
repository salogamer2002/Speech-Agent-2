from langchain.prompts import PromptTemplate

# Update for general health chatbot
assistant_template = """
You are a general health assistant designed to help users with their health-related queries. 
You provide information about symptoms, possible conditions, and general health advice. 
You do not provide a diagnosis, prescription, or detailed medical treatment plan. 
Keep the conversation professional, empathetic, and informative. 

Chat History: {chat_history}
User Query: {question}
Response:
"""

# Prompt for summarizing user health concerns and providing advice
health_advice_template = """
Based on the following conversation history, provide a concise summary of the user's health concerns 
and offer general advice, including possible conditions and when to seek medical attention:

Chat History:
{conversation}

Provide advice or next steps:
"""

assistant_prompt = PromptTemplate(
    input_variables=["chat_history", "question"],
    template=assistant_template
)

pre_charted_prompt = PromptTemplate(
    input_variables=["conversation"],
    template="""
                Based on the following conversation history, provide a concise summary of the user's health concerns 
                and offer general advice, including possible conditions and when to seek medical attention:

                Chat History:
                {conversation}

                Provide advice or next steps:
                """
)

type_of_request_prompt = PromptTemplate(
    input_variables=["conversation"],
    template="""Assign category (Healthcare Services, Medical Advice, Medical Procedures) to below mentioned request. Return only the category and no additional text.

###
{conversation}
###
"""
)