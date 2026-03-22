from dotenv import load_dotenv
load_dotenv()

from knowledge_base import KnowledgeBase

print("Connecting to databases...")
kb = KnowledgeBase()

print("Bootstrapping Neo4j indexes...")
print("Bootstrapping pgvector table...")
kb.bootstrap()

kb.close()
print("Done! Databases are ready.")