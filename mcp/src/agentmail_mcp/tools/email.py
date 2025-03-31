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
        error_msg = "Client not initialized. Please call setup_client() first."
        logger.error(error_msg)
        return {"error": error_msg, "status": "failed"}

    auth_header = client.headers.get("Authorization", "None")
    if auth_header.startswith("Bearer "):
        masked_token = auth_header[:10] + "..." + auth_header[-5:] if len(auth_header) > 15 else "Bearer [token]"
        logger.info(f"Using Authorization: {masked_token}")
    
    try:
        logger.info(f"Making API request: {method.upper()} {path}")
        if method.lower() == "get":
            response = await client.get(path, **kwargs)
        elif method.lower() == "post":
            response = await client.post(path, **kwargs)
        elif method.lower() == "put":
            response = await client.put(path, **kwargs)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        logger.info(f"API response status: {response.status_code}")
        response.raise_for_status()
        
        result = response.json()
        logger.info(f"API response: {result}")
        
        # Check if response is empty or has no meaningful content
        if not result or (isinstance(result, dict) and not any(result.values())):
            return {"message": "The API returned an empty result", "data": result, "status": "success"}
            
        return result
    except httpx.HTTPStatusError as e:
        error_msg = f"HTTP error: {e.response.status_code} - {e.response.text}"
        logger.error(f"API request error ({method} {path}): {error_msg}")
        return {"error": error_msg, "status": "failed", "status_code": e.response.status_code}
    except httpx.RequestError as e:
        error_msg = f"Request error: {str(e)}"
        logger.error(f"API request error ({method} {path}): {error_msg}")
        return {"error": error_msg, "status": "failed"}
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        logger.error(f"API request error ({method} {path}): {error_msg}")
        return {"error": error_msg, "status": "failed"}

def register_tools(mcp):
    """Register all email tools with the MCP server."""
    
    # Inbox operations
    @mcp.tool(description="List all inboxes")
    async def listInboxes(limit: Optional[int] = None, offset: Optional[int] = None) -> str:
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
        
        if "error" in result:
            return f"Error listing inboxes: {result['error']}"
        
        # Check if we got inboxes or an empty list
        if "data" in result and isinstance(result["data"], list):
            if not result["data"]:
                return "No inboxes found. You may need to create an inbox first."
            return f"Found {len(result['data'])} inboxes: {result}"
        
        return str(result)
    
    @mcp.tool(description="Get inbox by ID")
    async def getInbox(inbox_id: str) -> str:
        """
        Get inbox by ID.
        
        Args:
            inbox_id: ID of the inbox to retrieve
        """
        result = await make_api_request("GET", f"/inboxes/{inbox_id}")
        return str(result)
    
    @mcp.tool(description="Create a new inbox")
    async def createInbox(username: Optional[str] = None, domain: Optional[str] = None, display_name: Optional[str] = None) -> str:
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
    async def listThreads(inbox_id: str, limit: Optional[int] = None, offset: Optional[int] = None) -> str:
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
    async def getThread(inbox_id: str, thread_id: str) -> str:
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
    async def listMessages(inbox_id: str, limit: Optional[int] = None, offset: Optional[int] = None) -> str:
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
    async def getMessage(inbox_id: str, message_id: str) -> str:
        """
        Get message by ID.
        
        Args:
            message_id: ID of the message to retrieve
        """
        result = await make_api_request("GET", f"/inboxes/{inbox_id}/messages/{message_id}")
        return str(result)
    
    # Attachment operations
    @mcp.tool(description="Get attachment by ID")
    async def getAttachment(inbox_id: str, message_id: str, attachment_id: str) -> str:
        """
        Get attachment by ID.
        
        Args:
            attachment_id: ID of the attachment to retrieve
        """
        result = await make_api_request("GET", f"/inboxes/{inbox_id}/messages/{message_id}/attachments/{attachment_id}")
        return str(result)
    
    logger.info("Email tools registered")

    @mcp.tool(description="Send a message")
    async def sendMessage(
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
    async def replyToMessage(
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
        "listInboxes": listInboxes,
        "getInbox": getInbox,
        "createInbox": createInbox,
        "listThreads": listThreads,
        "getThread": getThread,
        "listMessages": listMessages,
        "getMessage": getMessage,
        "sendMessage": sendMessage,
        "replyToMessage": replyToMessage,
        "getAttachment": getAttachment
    }