# route_test.py - Script to test API routes and diagnose issues
# Run with: python route_test.py
import requests
import json
import time
import os
from tabulate import tabulate
from colorama import Fore, Style, init

# Initialize colorama
init()

# Configuration
BASE_URL = "http://127.0.0.1:5000"  # Default local FastAPI server URL
ENDPOINTS = [
    "/api/batches",
    "/api/batches/",
    "/api/statistics",
    "/api/statistics/",
    "/api/statistics/offline",
    "/api/classes",
    "/api/classes/",
    "/diagnostic/api-health",
    "/diagnostic/route-test",
    "/healthcheck",
    "/diagnostic-tool"
]

def test_endpoints():
    """Test all endpoints and display results in a table"""
    print(f"{Fore.BLUE}==== API Endpoint Tester ===={Style.RESET_ALL}")
    print(f"Testing against base URL: {BASE_URL}\n")
    
    results = []
    
    for endpoint in ENDPOINTS:
        full_url = f"{BASE_URL}{endpoint}"
        print(f"Testing {Fore.CYAN}{endpoint}{Style.RESET_ALL}... ", end="", flush=True)
        
        try:
            start_time = time.time()
            response = requests.get(full_url, timeout=5)
            elapsed_ms = int((time.time() - start_time) * 1000)
            
            # Determine status color
            if response.ok:
                status_color = Fore.GREEN
            else:
                status_color = Fore.RED
                
            # Try to parse JSON response
            content_type = response.headers.get("Content-Type", "")
            if "application/json" in content_type:
                try:
                    data = response.json()
                    data_preview = json.dumps(data)[:50] + "..." if len(json.dumps(data)) > 50 else json.dumps(data)
                except:
                    data_preview = "[Invalid JSON]"
            else:
                data_preview = f"[{content_type}]"
                
            print(f"{status_color}{response.status_code}{Style.RESET_ALL} ({elapsed_ms}ms)")
            
            results.append([
                endpoint,
                f"{status_color}{response.status_code}{Style.RESET_ALL}",
                f"{elapsed_ms}ms",
                data_preview
            ])
            
        except requests.exceptions.ConnectionError:
            print(f"{Fore.RED}Failed - Connection Error{Style.RESET_ALL}")
            results.append([endpoint, f"{Fore.RED}Error{Style.RESET_ALL}", "N/A", "Connection Error"])
        except requests.exceptions.Timeout:
            print(f"{Fore.RED}Failed - Timeout{Style.RESET_ALL}")
            results.append([endpoint, f"{Fore.RED}Timeout{Style.RESET_ALL}", "N/A", "Request timed out"])
        except Exception as e:
            print(f"{Fore.RED}Failed - {str(e)}{Style.RESET_ALL}")
            results.append([endpoint, f"{Fore.RED}Error{Style.RESET_ALL}", "N/A", str(e)])
    
    # Display results table
    print("\n")
    print(tabulate(results, headers=["Endpoint", "Status", "Time", "Response Preview"], tablefmt="fancy_grid"))
    
    # Count successful and failed requests
    success_count = sum(1 for r in results if "GREEN" in r[1])
    fail_count = len(results) - success_count
    
    print(f"\nSummary: {Fore.GREEN}{success_count} succeeded{Style.RESET_ALL}, {Fore.RED}{fail_count} failed{Style.RESET_ALL} out of {len(results)} total endpoints")

if __name__ == "__main__":
    try:
        # Check if tabulate is installed
        import tabulate
    except ImportError:
        print("Installing required packages...")
        os.system("pip install tabulate colorama requests")
        print("Packages installed successfully!")
    
    test_endpoints()
