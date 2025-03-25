#!/usr/bin/env python3
import logging
import os
from fastmcp import FastMCP
from dotenv import load_dotenv
import sys
import traceback

# Add the current directory to the Python path so 'tools' can be found
# current_dir = os.path.dirname(os.path.abspath(__file__))
# if current_dir not in sys.path:
#     sys.path.insert(0, current_dir)
# Detailed debug logging
print(f"Python version: {sys.version}", file=sys.stderr)
print(f"Working directory: {os.getcwd()}", file=sys.stderr)
print(f"Script location: {os.path.abspath(__file__)}", file=sys.stderr)
print(f"Python path before modification: {sys.path}", file=sys.stderr)


script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(script_dir)
print(f"Python path after modification: {sys.path}", file=sys.stderr)


# Import tool modules
# from tools import email

# Try importing tools
try:
    from tools import email
    print("✅ Successfully imported tools.email", file=sys.stderr)
except Exception as e:
    print(f"❌ Failed to import tools.email: {e}", file=sys.stderr)
    print("Traceback:", file=sys.stderr)
    traceback.print_exc(file=sys.stderr)
    
    # Try to find the tools
    tools_dir = os.path.join(script_dir, 'tools')
    if os.path.exists(tools_dir):
        print(f"Tools directory exists at: {tools_dir}", file=sys.stderr)
        print(f"Contents: {os.listdir(tools_dir)}", file=sys.stderr)
    else:
        print(f"Tools directory does not exist at: {tools_dir}", file=sys.stderr)

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("agentmail_mcp")

class AgentmailMCPServer:
    def __init__(self, api_key: str = None):
        self.name = "agentmail"
        self.api_key = api_key
        self.mcp = FastMCP(
            name=self.name,
            # host="127.0.0.1",
            # port=5000,
            # timeout=30
        )
        
        # Setup API client
        email.setup_client(self.api_key)
        
        # Register tools
        self._register_tools()

    def _register_tools(self):
        """Register all MCP tools."""
        # Register email tools
        email.register_tools(self.mcp)
        logger.info("All tools registered successfully")

    def run(self):
        """Run the MCP server."""
        logger.info(f"Starting {self.name} MCP server on 127.0.0.1:5000")
        self.mcp.run(transport='stdio')

def main():
    """Entry point for the MCP server."""
    import argparse
    
    # Parse command line arguments for the api key
    parser = argparse.ArgumentParser(description="AgentMail MCP Server")
    parser.add_argument("--api-key", help="AgentMail API key")
    args = parser.parse_args()
    
    # Get API key from args or environment (stripe gets it from the args)
    api_key = args.api_key or os.getenv("AGENTMAIL_API_KEY")
    if not api_key:
        logger.warning("No API key provided. Some functionality may be limited.")
    
    # Create and run server
    server = AgentmailMCPServer(api_key=api_key)
    server.run()

if __name__ == "__main__":
    main()