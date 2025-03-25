import logging
import httpx
from typing import Dict, Any, List, Optional
from mcp.types import TextContent

logger = logging.getLogger("agentmail_mcp")

client = None

def setup_client(api_key: Optional[str] = None):
    """Setup the API client with authentication."""
    global client
    
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    
    client = httpx.AsyncClient(
        base_url="https://api.agentmail.to/v0",
        headers=headers,
        timeout=30.0
    )
    return client

async def make_api_request(method: str, path: str, **kwargs) -> Dict[str, Any]:
    """Make a request to the AgentMail API"""
    global client
    if client is None:
        logger.error("Client not initialized. Please call setup_client() first.")

    auth_header = client.headers.get("Authorization", "None")
    if auth_header.startswith("Bearer "):
        masked_token = auth_header[:10] + "..." + auth_header[-5:] if len(auth_header) > 15 else "Bearer [token]"
        logger.info(f"Using Authorization: {masked_token}")
    
    try:
        if method.lower() == "get":
            response = await client.get(path, **kwargs)
        elif method.lower() == "post":
            response = await client.post(path, **kwargs)
        elif method.lower() == "put":
            response = await client.put(path, **kwargs)
        elif method.lower() == "delete":
            response = await client.delete(path, **kwargs)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
            
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"API request error ({method} {path}): {e}")
        return {"error": str(e)}

def register_tools(mcp):
    """Register all email tools with the MCP server."""
    
    # Inbox operations
    @mcp.tool(description="List all inboxes")
    async def list_inboxes(limit: Optional[int] = None, offset: Optional[int] = None) -> str:
        """
        List all inboxes.
        
        Args:
            limit: Maximum number of inboxes to return
            offset: Number of inboxes to skip
        """
        params = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
            
        result = await make_api_request("GET", "/inboxes", params=params)
        return str(result)
    
    @mcp.tool(description="Get inbox by ID")
    async def get_inbox(inbox_id: str) -> str:
        """
        Get inbox by ID.
        
        Args:
            inbox_id: ID of the inbox to retrieve
        """
        result = await make_api_request("GET", f"/inboxes/{inbox_id}")
        return str(result)
    
    @mcp.tool(description="Create a new inbox")
    async def create_inbox(username: Optional[str] = None, domain: Optional[str] = None, display_name: Optional[str] = None) -> str:
        """
        Create a new inbox. Use default username, domain, and display name unless otherwise specified.
        
        Args:
            username: Email username (optional)
            domain: Email domain (optional)
            display_name: Display name for the inbox (optional)
        """
        payload = {}
        if username:
            payload["username"] = username
        if domain:
            payload["domain"] = domain
        if display_name:
            payload["display_name"] = display_name
            
        result = await make_api_request("POST", "/inboxes", json=payload)
        return str(result)
    
    # Thread operations
    @mcp.tool(description="List threads by inbox ID")
    async def list_threads(inbox_id: str, limit: Optional[int] = None, offset: Optional[int] = None) -> str:
        """
        List threads by inbox ID.
        
        Args:
            inbox_id: ID of the inbox
            limit: Maximum number of threads to return
            offset: Number of threads to skip
        """
        params = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
            
        result = await make_api_request("GET", f"/inboxes/{inbox_id}/threads", params=params)
        return str(result)
    
    @mcp.tool(description="Get thread by ID")
    async def get_thread(inbox_id: str, thread_id: str) -> str:
        """
        Get thread by ID.
        
        Args:
            inbox_id: ID of the inbox
            thread_id: ID of the thread to retrieve
        """
        result = await make_api_request("GET", f"/inboxes/{inbox_id}/threads/{thread_id}")
        return str(result)
    
    # Message operations
    @mcp.tool(description="List messages")
    async def list_messages(inbox_id: str, limit: Optional[int] = None, offset: Optional[int] = None) -> str:
        """
        List messages by thread ID.
        
        Args:
            thread_id: ID of the thread
            limit: Maximum number of messages to return
            offset: Number of messages to skip
        """
        params = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset
            
        result = await make_api_request("GET", f"/inboxes/{inbox_id}/messages", params=params)
        return str(result)
    
    @mcp.tool(description="Get message by ID")
    async def get_message(inbox_id: str, message_id: str) -> str:
        """
        Get message by ID.
        
        Args:
            message_id: ID of the message to retrieve
        """
        result = await make_api_request("GET", f"/inboxes/{inbox_id}/messages/{message_id}")
        return str(result)
    
    # Attachment operations
    @mcp.tool(description="Get attachment by ID")
    async def get_attachment(inbox_id: str, message_id: str, attachment_id: str) -> str:
        """
        Get attachment by ID.
        
        Args:
            attachment_id: ID of the attachment to retrieve
        """
        result = await make_api_request("GET", f"/inboxes/{inbox_id}/messages/{message_id}/attachments/{attachment_id}")
        return str(result)
    
    logger.info("Email tools registered")

    @mcp.tool(description="Send a message")
    async def send_message(
        inbox_id: str, 
        to: List[str], 
        subject: str, 
        text: str, 
        cc: Optional[List[str]] = None, 
        bcc: Optional[List[str]] = None, 
        html: Optional[str] = None
    ) -> str:
        """
        Send a message.
        
        Args:
            inbox_id: ID of the sending inbox
            to: Recipient email addresses
            subject: Email subject
            body: Email body content
            cc: CC recipients
            bcc: BCC recipients
            html: HTML email body (optional)
        """
        payload = {
            "to": to,
            "subject": subject,
            "text": text
        }
        
        if cc:
            payload["cc"] = cc
        if bcc:
            payload["bcc"] = bcc
        if html:
            payload["html"] = html
            
        result = await make_api_request("POST", f"/inboxes/{inbox_id}/messages/send", json=payload)
        return str(result)
    
    @mcp.tool(description="Reply to a message")
    async def reply_to_message(
        inbox_id: str,
        message_id: str, 
        text: str, 
        html: Optional[str] = None,
        include_quoted_reply: Optional[bool] = None
    ) -> str:
        """
        Reply to a message.
        
        Args:
            message_id: ID of the message to reply to
            body: Reply body content
            html: HTML reply body (optional)
            include_quoted_reply: Whether to include the original message as a quote
        """
        payload = {
            "text": text
        }
        
        if html:
            payload["html"] = html
        if include_quoted_reply is not None:
            payload["include_quoted_reply"] = include_quoted_reply
            
        result = await make_api_request("POST", f"/inboxes/{inbox_id}/messages/{message_id}/reply", json=payload)
        return str(result)
    return {
        "list_inboxes": list_inboxes,
        "get_inbox": get_inbox,
        "create_inbox": create_inbox,
        "list_threads": list_threads,
        "get_thread": get_thread,
        "list_messages": list_messages,
        "get_message": get_message,
        "send_message": send_message,
        "reply_to_message": reply_to_message,
        "get_attachment": get_attachment
    }