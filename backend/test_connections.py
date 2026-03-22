from dotenv import load_dotenv
load_dotenv()
import os

# Test Neo4j
from neo4j import GraphDatabase
driver = GraphDatabase.driver(
    os.getenv('NEO4J_URI'),
    auth=(os.getenv('NEO4J_USER'), os.getenv('NEO4J_PASSWORD'))
)
driver.verify_connectivity()
driver.close()
print('Neo4j OK')

# Test Postgres
import psycopg2
conn = psycopg2.connect(os.getenv('PG_DSN'))
conn.close()
print('Postgres OK')