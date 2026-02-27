# backend/test_es_connection.py

from elasticsearch import Elasticsearch
from elasticsearch.exceptions import ConnectionError, TransportError
import sys

# Use the explicit IPv4 loopback address
ELASTICSEARCH_HOST = "http://127.0.0.1:9200"

# Set a higher timeout for the client
TIMEOUT_SECONDS = 30 

try:
    print(f"Attempting to get cluster info from Elasticsearch at {ELASTICSEARCH_HOST} with a {TIMEOUT_SECONDS}s timeout...")
    es_client = Elasticsearch([ELASTICSEARCH_HOST], request_timeout=TIMEOUT_SECONDS)
    
    # Try to get cluster info, which is a more substantial check than ping()
    info = es_client.info()
    print(f"SUCCESS: Successfully connected to Elasticsearch and retrieved info.")
    print(f"Elasticsearch Version: {info['version']['number']}")
    print(f"Cluster Name: {info['cluster_name']}")
    print(f"Node Name: {info['name']}")
    
except ConnectionError as e:
    print(f"ERROR: Connection to Elasticsearch failed. Ensure Elasticsearch is running and accessible.")
    print(f"Message: {e}")
    # traceback.print_exc(file=sys.stdout)
except TransportError as e:
    print(f"ERROR: Elasticsearch returned a transport error. This might be a security or configuration issue.")
    print(f"Status Code: {e.status_code}")
    print(f"Error Message: {e.errors}")
    print(f"Full Response: {e.body}")
    # traceback.print_exc(file=sys.stdout)
except Exception as e:
    print(f"ERROR: An unexpected error occurred while connecting to Elasticsearch.")
    print(f"Type: {type(e)}")
    print(f"Message: {e}")
    import traceback; traceback.print_exc(file=sys.stdout)
