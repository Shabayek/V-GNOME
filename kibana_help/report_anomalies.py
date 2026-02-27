import os
from elasticsearch import Elasticsearch
from tabulate import tabulate # For pretty printing

# Initialize ES Client
ES_HOST = os.getenv("ELASTICSEARCH_HOST", "http://localhost:9200")
es = Elasticsearch(ES_HOST)

def run_anomaly_report():
    print(f"--- Running Genomic Anomaly Report (ES|QL) ---")
    
    # ES|QL Query:
    # 1. Start from genomic_profiles
    # 2. Calculate average GC per cluster
    # 3. We use a simple STATS first to show cluster averages
    # 4. In a production scenario, you would use ENRICH to compare individuals to these stats
    query = """
    FROM genomic_profiles
    | STATS 
        avg_gc = AVG(metrics.gc_content), 
        max_gc = MAX(metrics.gc_content), 
        min_gc = MIN(metrics.gc_content),
        count = COUNT(*)
      BY cluster_id
    | SORT cluster_id ASC
    """

    try:
        # Execute ES|QL
        res = es.esql.query(query=query)
        
        # Format results for the console
        columns = [col['name'] for col in res['columns']]
        rows = res['values']
        
        if not rows:
            print("No data found in genomic_profiles index.")
            return

        print(tabulate(rows, headers=columns, tablefmt="grid"))
        
        print("[Analysis] Clusters with large Min/Max spreads indicate potential high-drift species.")
        
    except Exception as e:
        print(f"Error running ES|QL query: {e}")

if __name__ == "__main__":
    run_anomaly_report()
