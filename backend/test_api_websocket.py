"""
Test script for Flask API and WebSocket Server integration.

This script tests:
1. Flask API endpoints (org, meetings, process)
2. WebSocket server endpoints (health, connections, broadcast)
3. Integration between Flask API and WebSocket server

Usage:
    # Start both servers first:
    # Terminal 1: python app.py (runs on port 5001)
    # Terminal 2: python websocket_server.py (runs on port 8000)
    
    # Run tests:
    python test_api_websocket.py
    
    # Run specific test groups:
    python test_api_websocket.py --api-only
    python test_api_websocket.py --ws-only
    python test_api_websocket.py --integration-only
"""

import asyncio
import json
import sys
import time
import unittest
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
import argparse

import requests
import websockets


# Server URLs
FLASK_API_URL = "http://localhost:5001"
WEBSOCKET_SERVER_URL = "http://localhost:8000"
WEBSOCKET_WS_URL = "ws://localhost:8000"


class Colors:
    """ANSI color codes for terminal output."""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


def print_header(text: str):
    """Print a formatted header."""
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'=' * 60}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text}{Colors.RESET}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'=' * 60}{Colors.RESET}\n")


def print_success(text: str):
    """Print success message."""
    print(f"{Colors.GREEN}✅ {text}{Colors.RESET}")


def print_error(text: str):
    """Print error message."""
    print(f"{Colors.RED}❌ {text}{Colors.RESET}")


def print_info(text: str):
    """Print info message."""
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.RESET}")


def print_warning(text: str):
    """Print warning message."""
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.RESET}")


# ==================== SERVER HEALTH CHECKS ====================

def check_flask_server() -> bool:
    """Check if Flask server is running."""
    try:
        response = requests.get(f"{FLASK_API_URL}/orgs", timeout=2)
        return True
    except requests.ConnectionError:
        return False


def check_websocket_server() -> bool:
    """Check if WebSocket server is running."""
    try:
        response = requests.get(f"{WEBSOCKET_SERVER_URL}/health", timeout=2)
        return response.status_code == 200
    except requests.ConnectionError:
        return False


# ==================== FLASK API TESTS ====================

class TestFlaskAPI(unittest.TestCase):
    """Tests for the Flask API endpoints."""
    
    @classmethod
    def setUpClass(cls):
        """Check Flask server is available before running tests."""
        if not check_flask_server():
            raise unittest.SkipTest("Flask server not running on port 5001")
    
    def test_01_get_all_orgs(self):
        """Test GET /orgs endpoint."""
        print_info("Testing GET /orgs...")
        
        response = requests.get(f"{FLASK_API_URL}/orgs")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('orgs', data)
        self.assertIsInstance(data['orgs'], list)
        
        print_success(f"GET /orgs returned {len(data['orgs'])} orgs")
    
    def test_02_get_current_org(self):
        """Test GET /org endpoint."""
        print_info("Testing GET /org...")
        
        response = requests.get(f"{FLASK_API_URL}/org")
        
        # May return 404 if no orgs exist, which is valid
        if response.status_code == 404:
            print_warning("No orgs found (expected for empty DB)")
            return
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('orgId', data)
        
        print_success(f"GET /org returned orgId: {data['orgId']}")
    
    def test_03_create_meeting(self):
        """Test POST /meeting endpoint."""
        print_info("Testing POST /meeting...")
        
        payload = {"orgId": "test-org"}
        response = requests.post(f"{FLASK_API_URL}/meeting", json=payload)
        
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertIn('meetingId', data)
        self.assertIn('currentStateId', data)
        
        # Store meeting ID for later tests
        TestFlaskAPI.test_meeting_id = data['meetingId']
        
        print_success(f"Created meeting: {data['meetingId'][:8]}...")
    
    def test_04_get_meeting(self):
        """Test GET /meeting endpoint."""
        print_info("Testing GET /meeting...")
        
        # Use the meeting created in previous test
        meeting_id = getattr(TestFlaskAPI, 'test_meeting_id', None)
        if not meeting_id:
            self.skipTest("No meeting ID from previous test")
        
        response = requests.get(f"{FLASK_API_URL}/meeting", params={"meetingId": meeting_id})
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('meeting', data)
        self.assertIn('currentState', data)
        self.assertEqual(data['meeting']['meetingId'], meeting_id)
        
        print_success(f"GET /meeting returned state version: {data['currentState']['version']}")
    
    def test_05_get_meeting_missing_id(self):
        """Test GET /meeting without meetingId returns 400."""
        print_info("Testing GET /meeting without meetingId...")
        
        response = requests.get(f"{FLASK_API_URL}/meeting")
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('error', data)
        
        print_success("Correctly returned 400 for missing meetingId")
    
    def test_06_get_meeting_not_found(self):
        """Test GET /meeting with non-existent ID returns 404."""
        print_info("Testing GET /meeting with invalid ID...")
        
        response = requests.get(f"{FLASK_API_URL}/meeting", params={"meetingId": "non-existent-id"})
        
        self.assertEqual(response.status_code, 404)
        
        print_success("Correctly returned 404 for non-existent meeting")
    
    def test_07_get_meetings_by_org(self):
        """Test GET /meetings endpoint."""
        print_info("Testing GET /meetings...")
        
        response = requests.get(f"{FLASK_API_URL}/meetings", params={"orgId": "test-org"})
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('meetings', data)
        self.assertIsInstance(data['meetings'], list)
        
        print_success(f"GET /meetings returned {len(data['meetings'])} meetings for test-org")
    
    def test_08_get_meetings_missing_org_id(self):
        """Test GET /meetings without orgId returns 400."""
        print_info("Testing GET /meetings without orgId...")
        
        response = requests.get(f"{FLASK_API_URL}/meetings")
        
        self.assertEqual(response.status_code, 400)
        
        print_success("Correctly returned 400 for missing orgId")
    
    def test_09_process_chunk_missing_body(self):
        """Test POST /process without body returns 400 or 415."""
        print_info("Testing POST /process without body...")
        
        response = requests.post(f"{FLASK_API_URL}/process")
        
        # Server may return 400 (Bad Request) or 415 (Unsupported Media Type)
        self.assertIn(response.status_code, [400, 415])
        
        print_success(f"Correctly returned {response.status_code} for missing body")
    
    def test_10_process_chunk_invalid_meeting(self):
        """Test POST /process with invalid meetingId returns 404."""
        print_info("Testing POST /process with invalid meetingId...")
        
        payload = {
            "chunk": "This is a test chunk.",
            "meetingId": "non-existent-meeting-id"
        }
        response = requests.post(f"{FLASK_API_URL}/process", json=payload)
        
        self.assertEqual(response.status_code, 404)
        
        print_success("Correctly returned 404 for non-existent meeting")


# ==================== WEBSOCKET SERVER TESTS ====================

class TestWebSocketServer(unittest.TestCase):
    """Tests for the WebSocket server endpoints."""
    
    @classmethod
    def setUpClass(cls):
        """Check WebSocket server is available before running tests."""
        if not check_websocket_server():
            raise unittest.SkipTest("WebSocket server not running on port 8000")
    
    def test_01_health_check(self):
        """Test /health endpoint."""
        print_info("Testing GET /health...")
        
        response = requests.get(f"{WEBSOCKET_SERVER_URL}/health")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['status'], 'healthy')
        self.assertEqual(data['service'], 'websocket-server')
        
        print_success("Health check passed")
    
    def test_02_get_connections_no_meeting(self):
        """Test /connections/{meeting_id} for non-existent meeting."""
        print_info("Testing GET /connections for non-existent meeting...")
        
        response = requests.get(f"{WEBSOCKET_SERVER_URL}/connections/test-meeting")
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['connection_count'], 0)
        
        print_success("Correctly returned 0 connections")
    
    def test_03_broadcast_no_clients(self):
        """Test /broadcast/{meeting_id} with no connected clients."""
        print_info("Testing POST /broadcast with no clients...")
        
        payload = {
            "type": "full_state",
            "state": {"meetingSummary": "Test", "workflows": []}
        }
        response = requests.post(
            f"{WEBSOCKET_SERVER_URL}/broadcast/test-meeting",
            json=payload
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertEqual(data['clients_notified'], 0)
        
        print_success("Broadcast succeeded with 0 clients notified")
    
    def test_04_websocket_connection(self):
        """Test WebSocket connection and ping/pong."""
        print_info("Testing WebSocket connection...")
        
        async def test_ws():
            meeting_id = "ws-test-meeting"
            uri = f"{WEBSOCKET_WS_URL}/ws/{meeting_id}"
            
            async with websockets.connect(uri) as websocket:
                # Test ping/pong
                await websocket.send("ping")
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                self.assertEqual(response, "pong")
                
                # Check connection count
                http_response = requests.get(
                    f"{WEBSOCKET_SERVER_URL}/connections/{meeting_id}"
                )
                data = http_response.json()
                self.assertEqual(data['connection_count'], 1)
                
            return True
        
        result = asyncio.new_event_loop().run_until_complete(test_ws())
        self.assertTrue(result)
        
        print_success("WebSocket connection and ping/pong successful")
    
    def test_05_websocket_receive_broadcast(self):
        """Test receiving broadcast messages through WebSocket."""
        print_info("Testing WebSocket broadcast reception...")
        
        async def test_broadcast():
            meeting_id = "broadcast-test-meeting"
            uri = f"{WEBSOCKET_WS_URL}/ws/{meeting_id}"
            
            async with websockets.connect(uri) as websocket:
                # Wait a moment for connection to register
                await asyncio.sleep(0.1)
                
                # Send broadcast via HTTP
                test_state = {
                    "meetingSummary": "Test broadcast message",
                    "workflows": [
                        {
                            "id": "test-workflow",
                            "title": "Test Workflow",
                            "mermaidDiagram": "flowchart TD\n    A --> B",
                            "sources": ["chunk_0"]
                        }
                    ]
                }
                
                payload = {"type": "full_state", "state": test_state}
                requests.post(
                    f"{WEBSOCKET_SERVER_URL}/broadcast/{meeting_id}",
                    json=payload
                )
                
                # Receive the broadcast
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(message)
                
                self.assertEqual(data['type'], 'full_state')
                self.assertEqual(data['state']['meetingSummary'], "Test broadcast message")
                self.assertEqual(len(data['state']['workflows']), 1)
                
            return True
        
        result = asyncio.new_event_loop().run_until_complete(test_broadcast())
        self.assertTrue(result)
        
        print_success("WebSocket broadcast reception successful")
    
    def test_06_multiple_clients_broadcast(self):
        """Test broadcast to multiple WebSocket clients."""
        print_info("Testing broadcast to multiple clients...")
        
        async def test_multi_client():
            meeting_id = "multi-client-test"
            uri = f"{WEBSOCKET_WS_URL}/ws/{meeting_id}"
            received_messages = []
            
            async def client(client_id: int):
                async with websockets.connect(uri) as websocket:
                    await asyncio.sleep(0.1)  # Let connection register
                    message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                    received_messages.append((client_id, json.loads(message)))
            
            # Connect 3 clients
            tasks = [asyncio.create_task(client(i)) for i in range(3)]
            await asyncio.sleep(0.2)  # Let all clients connect
            
            # Verify connection count
            response = requests.get(f"{WEBSOCKET_SERVER_URL}/connections/{meeting_id}")
            conn_count = response.json()['connection_count']
            self.assertEqual(conn_count, 3)
            
            # Send broadcast
            payload = {"type": "full_state", "state": {"meetingSummary": "Multi-client test"}}
            response = requests.post(
                f"{WEBSOCKET_SERVER_URL}/broadcast/{meeting_id}",
                json=payload
            )
            self.assertEqual(response.json()['clients_notified'], 3)
            
            # Wait for all clients to receive
            await asyncio.gather(*tasks)
            
            # Verify all clients received the message
            self.assertEqual(len(received_messages), 3)
            for client_id, msg in received_messages:
                self.assertEqual(msg['state']['meetingSummary'], "Multi-client test")
            
            return True
        
        result = asyncio.new_event_loop().run_until_complete(test_multi_client())
        self.assertTrue(result)
        
        print_success("Broadcast to 3 clients successful")


# ==================== INTEGRATION TESTS ====================

class TestAPIWebSocketIntegration(unittest.TestCase):
    """Tests for Flask API and WebSocket server integration."""
    
    @classmethod
    def setUpClass(cls):
        """Check both servers are available before running tests."""
        if not check_flask_server():
            raise unittest.SkipTest("Flask server not running on port 5001")
        if not check_websocket_server():
            raise unittest.SkipTest("WebSocket server not running on port 8000")
    
    def test_01_full_flow_create_meeting_and_connect(self):
        """Test creating a meeting and connecting via WebSocket."""
        print_info("Testing full flow: create meeting and connect...")
        
        # Create a new meeting
        response = requests.post(f"{FLASK_API_URL}/meeting", json={"orgId": "integration-test"})
        self.assertEqual(response.status_code, 201)
        meeting_id = response.json()['meetingId']
        
        async def connect_and_verify():
            uri = f"{WEBSOCKET_WS_URL}/ws/{meeting_id}"
            async with websockets.connect(uri) as websocket:
                # Verify connection
                await websocket.send("ping")
                pong = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                self.assertEqual(pong, "pong")
                
                # Check connection count
                response = requests.get(f"{WEBSOCKET_SERVER_URL}/connections/{meeting_id}")
                self.assertEqual(response.json()['connection_count'], 1)
                
            return True
        
        result = asyncio.new_event_loop().run_until_complete(connect_and_verify())
        self.assertTrue(result)
        
        # Store for next tests
        TestAPIWebSocketIntegration.test_meeting_id = meeting_id
        
        print_success(f"Full flow successful for meeting {meeting_id[:8]}...")
    
    def test_02_meeting_state_via_both_channels(self):
        """Test that meeting state is consistent via API and WebSocket."""
        print_info("Testing state consistency across API and WebSocket...")
        
        meeting_id = getattr(TestAPIWebSocketIntegration, 'test_meeting_id', None)
        if not meeting_id:
            # Create a new meeting
            response = requests.post(f"{FLASK_API_URL}/meeting", json={"orgId": "integration-test"})
            meeting_id = response.json()['meetingId']
        
        # Get state via API
        response = requests.get(f"{FLASK_API_URL}/meeting", params={"meetingId": meeting_id})
        api_state = response.json()['currentState']
        
        async def receive_broadcast_state():
            uri = f"{WEBSOCKET_WS_URL}/ws/{meeting_id}"
            async with websockets.connect(uri) as websocket:
                await asyncio.sleep(0.1)
                
                # Trigger a broadcast with the same state
                payload = {
                    "type": "full_state",
                    "state": api_state['data']
                }
                requests.post(
                    f"{WEBSOCKET_SERVER_URL}/broadcast/{meeting_id}",
                    json=payload
                )
                
                # Receive the broadcast
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                ws_state = json.loads(message)
                
                # Verify states match
                self.assertEqual(ws_state['state'], api_state['data'])
                
            return True
        
        result = asyncio.new_event_loop().run_until_complete(receive_broadcast_state())
        self.assertTrue(result)
        
        print_success("State consistency verified across API and WebSocket")
    
    def test_03_broadcast_triggered_by_flask(self):
        """Test that Flask can trigger WebSocket broadcasts (mocked)."""
        print_info("Testing Flask -> WebSocket broadcast trigger...")
        
        meeting_id = "flask-trigger-test"
        
        async def listen_for_broadcast():
            uri = f"{WEBSOCKET_WS_URL}/ws/{meeting_id}"
            async with websockets.connect(uri) as websocket:
                await asyncio.sleep(0.1)
                
                # Simulate what Flask does when broadcasting
                test_state = {
                    "meetingSummary": "Flask triggered this broadcast",
                    "workflows": []
                }
                
                # Flask's broadcast_state_update function sends to this endpoint
                response = requests.post(
                    f"{WEBSOCKET_SERVER_URL}/broadcast/{meeting_id}",
                    json={"type": "full_state", "state": test_state},
                    timeout=5.0
                )
                
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.json()['success'])
                
                # Receive the broadcast
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json.loads(message)
                
                self.assertEqual(data['type'], 'full_state')
                self.assertEqual(data['state']['meetingSummary'], "Flask triggered this broadcast")
                
            return True
        
        result = asyncio.new_event_loop().run_until_complete(listen_for_broadcast())
        self.assertTrue(result)
        
        print_success("Flask -> WebSocket broadcast trigger works")


# ==================== LOAD/STRESS TESTS ====================

class TestLoadAndStress(unittest.TestCase):
    """Load and stress tests for both servers."""
    
    @classmethod
    def setUpClass(cls):
        """Check both servers are available."""
        if not check_flask_server():
            raise unittest.SkipTest("Flask server not running on port 5001")
        if not check_websocket_server():
            raise unittest.SkipTest("WebSocket server not running on port 8000")
    
    def test_01_concurrent_meeting_creation(self):
        """Test creating multiple meetings concurrently."""
        print_info("Testing concurrent meeting creation (10 meetings)...")
        
        def create_meeting(index):
            response = requests.post(
                f"{FLASK_API_URL}/meeting",
                json={"orgId": f"load-test-{index}"}
            )
            return response.status_code == 201
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(create_meeting, range(10)))
        
        success_count = sum(results)
        self.assertEqual(success_count, 10)
        
        print_success(f"Created {success_count}/10 meetings concurrently")
    
    def test_02_multiple_websocket_connections(self):
        """Test handling multiple WebSocket connections."""
        print_info("Testing multiple WebSocket connections (20 clients)...")
        
        async def connect_many():
            meeting_id = "load-test-ws"
            uri = f"{WEBSOCKET_WS_URL}/ws/{meeting_id}"
            
            async def client(index):
                async with websockets.connect(uri) as websocket:
                    await asyncio.sleep(0.5)  # Stay connected briefly
                    return True
            
            # Connect 20 clients
            tasks = [client(i) for i in range(20)]
            await asyncio.sleep(0.2)  # Let connections establish
            
            # Check connection count before tasks complete
            response = requests.get(f"{WEBSOCKET_SERVER_URL}/connections/{meeting_id}")
            conn_count = response.json()['connection_count']
            
            results = await asyncio.gather(*tasks)
            return conn_count, sum(results)
        
        conn_count, success_count = asyncio.new_event_loop().run_until_complete(connect_many())
        
        self.assertGreater(conn_count, 0)
        self.assertEqual(success_count, 20)
        
        print_success(f"Handled {conn_count} concurrent connections, {success_count}/20 clients successful")
    
    def test_03_rapid_broadcasts(self):
        """Test rapid succession of broadcasts."""
        print_info("Testing rapid broadcasts (50 messages)...")
        
        async def rapid_broadcast():
            meeting_id = "rapid-broadcast-test"
            uri = f"{WEBSOCKET_WS_URL}/ws/{meeting_id}"
            messages_received = []
            
            async with websockets.connect(uri) as websocket:
                await asyncio.sleep(0.1)
                
                # Send 50 broadcasts rapidly
                for i in range(50):
                    payload = {
                        "type": "full_state",
                        "state": {"meetingSummary": f"Message {i}", "workflows": []}
                    }
                    requests.post(
                        f"{WEBSOCKET_SERVER_URL}/broadcast/{meeting_id}",
                        json=payload
                    )
                
                # Receive all messages
                try:
                    while True:
                        message = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                        messages_received.append(json.loads(message))
                except asyncio.TimeoutError:
                    pass  # No more messages
                
            return len(messages_received)
        
        received_count = asyncio.new_event_loop().run_until_complete(rapid_broadcast())
        
        self.assertGreater(received_count, 0)
        
        print_success(f"Received {received_count}/50 rapid broadcasts")


# ==================== MAIN ====================

def run_tests(test_classes: list, verbosity: int = 2):
    """Run specified test classes."""
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    for test_class in test_classes:
        tests = loader.loadTestsFromTestCase(test_class)
        suite.addTests(tests)
    
    runner = unittest.TextTestRunner(verbosity=verbosity)
    result = runner.run(suite)
    
    return result.wasSuccessful()


def main():
    parser = argparse.ArgumentParser(description="Test Flask API and WebSocket Server")
    parser.add_argument("--api-only", action="store_true", help="Run only Flask API tests")
    parser.add_argument("--ws-only", action="store_true", help="Run only WebSocket server tests")
    parser.add_argument("--integration-only", action="store_true", help="Run only integration tests")
    parser.add_argument("--load-only", action="store_true", help="Run only load tests")
    parser.add_argument("--skip-load", action="store_true", help="Skip load tests")
    args = parser.parse_args()
    
    print_header("Blueprint API & WebSocket Test Suite")
    
    # Check server status
    flask_running = check_flask_server()
    ws_running = check_websocket_server()
    
    print("Server Status:")
    if flask_running:
        print_success(f"Flask API running at {FLASK_API_URL}")
    else:
        print_error(f"Flask API NOT running at {FLASK_API_URL}")
    
    if ws_running:
        print_success(f"WebSocket server running at {WEBSOCKET_SERVER_URL}")
    else:
        print_error(f"WebSocket server NOT running at {WEBSOCKET_SERVER_URL}")
    
    if not flask_running and not ws_running:
        print_error("\nNo servers running. Please start the servers first:")
        print_info("  Terminal 1: cd backend && python app.py")
        print_info("  Terminal 2: cd backend && python websocket_server.py")
        sys.exit(1)
    
    print()
    
    # Determine which tests to run
    test_classes = []
    
    if args.api_only:
        test_classes = [TestFlaskAPI]
    elif args.ws_only:
        test_classes = [TestWebSocketServer]
    elif args.integration_only:
        test_classes = [TestAPIWebSocketIntegration]
    elif args.load_only:
        test_classes = [TestLoadAndStress]
    else:
        # Run all tests
        test_classes = [TestFlaskAPI, TestWebSocketServer, TestAPIWebSocketIntegration]
        if not args.skip_load:
            test_classes.append(TestLoadAndStress)
    
    # Run tests
    success = run_tests(test_classes)
    
    print_header("Test Summary")
    if success:
        print_success("All tests passed!")
    else:
        print_error("Some tests failed")
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()

