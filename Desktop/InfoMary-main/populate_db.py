"""
Script to populate ChromaDB with health information
Run this ONCE to create and populate your vector database
"""

from dotenv import load_dotenv
import chromadb
from chromadb.config import Settings
from langchain_huggingface import HuggingFaceEmbeddings

load_dotenv()

# Initialize ChromaDB
db = chromadb.PersistentClient(path="./db", settings=Settings(allow_reset=True))
collection_name = "MATZ_Health_Bot"

# Initialize embedding model
embedding_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

# Sample health data (replace with your actual data)
health_documents = [
    "Common cold symptoms include runny nose, sore throat, cough, congestion, and mild fever. Rest and hydration are recommended.",
    "High blood pressure can be managed through diet, exercise, stress reduction, and medication if prescribed by a doctor.",
    "Diabetes management includes monitoring blood sugar levels, maintaining a healthy diet, regular exercise, and taking prescribed medications.",
    "Senior care services include assisted living, nursing homes, home health care, and rehabilitation services.",
    "Memory care facilities specialize in caring for individuals with Alzheimer's disease and other forms of dementia.",
    "Physical therapy helps seniors maintain mobility, strength, and independence through targeted exercises.",
    "Nutrition counseling for seniors focuses on maintaining healthy weight, managing chronic conditions, and ensuring adequate nutrient intake.",
    "Fall prevention strategies include removing tripping hazards, installing grab bars, improving lighting, and balance exercises.",
    "Medication management services help seniors organize medications, track schedules, and avoid dangerous interactions.",
    "Respite care provides temporary relief for family caregivers while ensuring continued care for their loved ones.",
]

def populate_database():
    """Populate ChromaDB with health information"""
    print("🔄 Starting database population...")
    
    try:
        # Delete existing collection if it exists
        try:
            db.delete_collection(collection_name)
            print(f"🗑️  Deleted existing collection: {collection_name}")
        except:
            print(f"ℹ️  No existing collection to delete")
        
        # Create new collection
        collection = db.create_collection(
            name=collection_name,
            metadata={"description": "Health bot knowledge base"}
        )
        print(f"✅ Created collection: {collection_name}")
        
        # Generate embeddings
        print("🔄 Generating embeddings...")
        embeddings = [embedding_model.embed_query(doc) for doc in health_documents]
        
        # Add documents to collection
        collection.add(
            embeddings=embeddings,
            documents=health_documents,
            ids=[f"doc_{i}" for i in range(len(health_documents))]
        )
        
        print(f"✅ Successfully added {len(health_documents)} documents to the database!")
        print(f"📊 Collection '{collection_name}' is ready to use!")
        
        # Verify
        count = collection.count()
        print(f"✅ Verification: Collection contains {count} documents")
        
    except Exception as e:
        print(f"❌ Error populating database: {e}")
        raise

if __name__ == "__main__":
    print("=" * 60)
    print("ChromaDB Population Script")
    print("=" * 60)
    populate_database()
    print("=" * 60)
    print("✨ Done! You can now run your chatbot with: python app.py")
    print("=" * 60)