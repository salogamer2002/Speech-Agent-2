# Doctor Chatbot - LangChain

## Overview
This project implements a Doctor Chatbot using the LangChain framework, OpenAI GPT-3.5-turbo-instruct model, and Chainlit for an interactive user interface. The chatbot helps patients pre-chart their information before a consultation by engaging in conversation, storing history, and generating a pre-charted note at the end. 

## Features
- **Conversation Handling**: The chatbot interacts with users to gather medical information through conversation.
- **Memory Management**: Stores the conversation history in memory for consistent interactions.
- **Pre-charted Note Generation**: At the end of the conversation, a pre-charted medical note is generated based on the collected information.
- **Data Export**: Saves the conversation history and the generated note as a JSON file.

## Key Components
1. **LangChain & OpenAI**:
   - Utilizes `OpenAI GPT-3.5-turbo-instruct` model for generating responses.
   - The conversation is managed by LangChain's `LLMChain` for structured prompts and handling inputs.
  
2. **Chainlit**:
   - Provides a user-friendly interface for interactions with the chatbot.
   - Manages the lifecycle of the chatbot, including chat start, message handling, and session management.

3. **Memory**:
   - Uses `ConversationBufferMemory` to store and retrieve the conversation history for meaningful responses and continuity in the dialogue.

4. **Pre-charted Note Generation**:
   - When the conversation ends, a pre-charted note is generated based on the entire conversation history using a separate `LLMChain`.

5. **Data Persistence**:
   - The conversation history and pre-charted note are saved as a JSON file locally on disk for future reference.

## Setup Instructions

### Prerequisites
- Python 3.8+
- Install the required libraries using the following command:
  ```bash
  pip install langchain-openai chainlit python-dotenv
  ```

- Set up your `.env` file with your OpenAI API key:
  ```bash
  OPENAI_API_KEY=your_openai_api_key
  ```

### File Structure
```bash
├── chatbot.py                # Main application file
├── prompts.py                # Contains the assistant_prompt and pre_charted_prompt
├── .env                      # OpenAI API key stored here
├── conversation_history      # Folder where JSON files of conversation history are saved
└── readme.md                 # Documentation
```

### Running the Application
1. **Clone the repository**:

2. **Run the chatbot**:
   ```bash
   chainlit run app.py
   ```
   This command will start the chatbot interface using Chainlit. It will be accessible on your browser, where you can interact with the chatbot.

### Sample Prompts
- On chat start, the chatbot will greet the user and ask for the reason for the visit:
  ```
  Doctor: Hello! I'm here to help pre-chart your information for your upcoming consultation. Could you please tell me briefly about the main reason for your visit today?
  ```

- To end the conversation, the user can type "exit". This will generate the pre-charted note and store the conversation:
  ```
  Patient: exit
  ```

## Customization
### Prompts
- The prompts used in the chatbot are stored in `prompts.py`. You can customize the assistant's behavior and tone by editing the prompts.
- Example:
  ```python
  assistant_prompt = PromptTemplate(
      input_variables=["chat_history", "question"],
      template="""You are an AI doctor assistant designed to pre-chart patient information before their doctor’s consultation. Your job is to ask up to 7 key questions that will help the doctor understand the patient’s main concerns, symptoms, medical history, medications, and lifestyle. You will not provide medical advice, diagnose, or prescribe anything. Keep the questions brief, clear, and friendly, but always professional. If the patient provides vague or incomplete answers, request clarification politely. Ensure the conversation is empathetic and confidential. You do not provide information outside of this scope. If a question is not about pre-charted note related, respond with, "I specialize only in questions related to pre-charted notes."
                     Chat History: {chat_history}
                     Question: {question}
                     Answer:"""
      )
  
   pre_charted_template = """###{conversation}###""" + f"""Suppose the above is a doctor-patient conversation, write a detailed pre-charted note. Based on the details in the conversation, assign a specialty from the following list: {', '.join(map(str, specialty_list)) }. If none of these specialties match the conversation, assign "Other."

   Do not include anything that is not mentioned in the conversation provided, and only use the details mentioned in the conversation. Remove any other points.

   Do not include any "Notes" section or similar additional sections in the generated pre-charted note. Only include relevant details from the conversation.
   """
  ```

### Model Parameters
- The chatbot uses GPT-3.5-turbo-instruct with specific parameters. These can be modified in the `OpenAI` instantiation within the code:
  ```python
  llm = OpenAI(model='gpt-3.5-turbo-instruct', temperature=0)
  ```
  You can adjust the model, temperature, and max tokens as needed.

## Data Handling
- **Conversation History**: Saved in the `conversation_history` directory with a timestamp in the filename.
- **File Format**: JSON format storing both the conversation and the generated pre-charted note.

## Future Improvements

### 1. **Literature Embedding (Wikipedia or PDF Books)**
   - **Description**: Enhance the chatbot by embedding external medical literature such as Wikipedia articles or medical textbooks (PDFs) to provide more informed and accurate responses. 
   - **Implementation**: Leverage vector-based search and embedding techniques to index and query relevant sections of medical literature when responding to the patient's queries.

### 2. **Context from Previous Notes**
   - **Description**: When a patient returns for subsequent visits, the chatbot can utilize the context from previous visit notes to provide better continuity in responses and recommendations.
   - **Implementation**: Store and retrieve the patient's previous notes using their unique identifier (e.g., patient ID) to provide historical context during consultations, making the chatbot more personalized and informed.

### 3. **Suggestions Dropdown for Each Question**
   - **Description**: Add a dropdown menu with suggested responses for commonly asked questions, making it easier for users to select relevant options, especially for standard questions like symptoms or previous diagnoses.
   - **Implementation**: Pre-populate options using structured data from medical ontologies or frequently used responses and display them in a user-friendly dropdown for quick selection.

### 4. **Graceful Automatic Exit**
   - **Description**: Introduce an intelligent exit process where the chatbot can gracefully end the conversation when it detects that the necessary information has been collected or when the user explicitly indicates they are finished.
   - **Implementation**: The chatbot can prompt the user with a final confirmation after completing the conversation or when the conversation reaches a natural conclusion. The system will generate and save the pre-charted note, and provide the user with an option to restart the session or download the notes.

### 5. **Mimicking Real Appointment Booking Flow**
   - **Description**: Observe and replicate the standard flow of a real-world doctor’s appointment booking and pre-charting process for more seamless and natural conversations.
   - **Implementation**: Incorporate elements such as patient identification, insurance verification, appointment scheduling, and pre-appointment questionnaires, closely mirroring the flow followed in traditional medical setups.

## License
This project is licensed under [Reteta](https://reteta.com), launched by [Visionet Ventures](https://www.visionetventures.com).

## Authors
Developed by [Rawaha Bin Khalid](mailto:rawaha.khalid@visionetsystems.com).