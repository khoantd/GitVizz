{
 "cells": [
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "# GitVizz GraphSearchTool v2 Demo\n",
    "\n",
    "**Clean, subgraph-centric API where every method returns a visualizable GraphGenerator**"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 1,
   "metadata": {},
   "outputs": [],
   "source": [
    "# Setup\n",
    "import sys\n",
    "from pathlib import Path\n",
    "sys.path.append(str(Path().parent))\n",
    "\n",
    "from gitvizz import GraphGenerator, GraphSearchTool"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 🏗️ Create Sample Codebase"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 2,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "GraphGenerator: Determined project root: /\n",
      "Identified project type: python\n",
      "📊 Created graph: 67 nodes, 80 edges\n",
      "📋 Categories: ['directory', 'module', 'class', 'method', 'external_symbol']\n"
     ]
    }
   ],
   "source": [
    "# FastAPI application codebase\n",
    "sample_files = [\n",
    "    {\n",
    "        \"path\": \"api/server.py\",\n",
    "        \"content\": '''\n",
    "from fastapi import FastAPI, HTTPException\n",
    "from .auth import AuthManager\n",
    "from .database import UserRepo, PostRepo\n",
    "from .models import User, Post, CreateUserRequest\n",
    "\n",
    "class APIServer:\n",
    "    def __init__(self):\n",
    "        self.app = FastAPI(title=\"Blog API\")\n",
    "        self.auth = AuthManager()\n",
    "        self.user_repo = UserRepo()\n",
    "        self.post_repo = PostRepo()\n",
    "    \n",
    "    def setup_routes(self):\n",
    "        @self.app.get(\"/users\")\n",
    "        async def list_users():\n",
    "            return await self.user_repo.get_all()\n",
    "        \n",
    "        @self.app.post(\"/users\")\n",
    "        async def create_user(request: CreateUserRequest):\n",
    "            if await self.user_repo.get_by_username(request.username):\n",
    "                raise HTTPException(400, \"User exists\")\n",
    "            return await self.user_repo.create(request)\n",
    "        \n",
    "        @self.app.get(\"/posts/{user_id}\")\n",
    "        async def get_user_posts(user_id: int):\n",
    "            return await self.post_repo.get_by_user(user_id)\n",
    "    \n",
    "    def run(self):\n",
    "        self.setup_routes()\n",
    "        return self.app\n",
    "''',\n",
    "        \"full_path\": \"/project/api/server.py\"\n",
    "    },\n",
    "    {\n",
    "        \"path\": \"api/auth.py\",\n",
    "        \"content\": '''\n",
    "import jwt\n",
    "from datetime import datetime, timedelta\n",
    "from .models import User\n",
    "from .database import UserRepo\n",
    "\n",
    "class AuthManager:\n",
    "    def __init__(self, secret=\"jwt-secret\"):\n",
    "        self.secret = secret\n",
    "        self.algorithm = \"HS256\"\n",
    "        self.user_repo = UserRepo()\n",
    "    \n",
    "    def create_token(self, user: User) -> str:\n",
    "        payload = {\n",
    "            \"user_id\": user.id,\n",
    "            \"username\": user.username,\n",
    "            \"exp\": datetime.utcnow() + timedelta(days=1)\n",
    "        }\n",
    "        return jwt.encode(payload, self.secret, algorithm=self.algorithm)\n",
    "    \n",
    "    def verify_token(self, token: str) -> dict:\n",
    "        return jwt.decode(token, self.secret, algorithms=[self.algorithm])\n",
    "    \n",
    "    async def login(self, username: str, password: str) -> User:\n",
    "        user = await self.user_repo.get_by_username(username)\n",
    "        if user and self.check_password(password, user.password_hash):\n",
    "            return user\n",
    "        return None\n",
    "    \n",
    "    def check_password(self, password: str, hash: str) -> bool:\n",
    "        return True  # Mock implementation\n",
    "\n",
    "class TokenValidator:\n",
    "    def __init__(self, auth_manager: AuthManager):\n",
    "        self.auth = auth_manager\n",
    "    \n",
    "    def validate(self, token: str) -> bool:\n",
    "        try:\n",
    "            self.auth.verify_token(token)\n",
    "            return True\n",
    "        except:\n",
    "            return False\n",
    "''',\n",
    "        \"full_path\": \"/project/api/auth.py\"\n",
    "    },\n",
    "    {\n",
    "        \"path\": \"api/database.py\",\n",
    "        \"content\": '''\n",
    "import asyncpg\n",
    "from typing import List, Optional\n",
    "from .models import User, Post, CreateUserRequest\n",
    "\n",
    "class DatabasePool:\n",
    "    def __init__(self, url: str = \"postgresql://localhost/blog\"):\n",
    "        self.url = url\n",
    "        self.pool = None\n",
    "    \n",
    "    async def connect(self):\n",
    "        self.pool = await asyncpg.create_pool(self.url)\n",
    "    \n",
    "    async def get_connection(self):\n",
    "        return self.pool.acquire()\n",
    "\n",
    "class BaseRepo:\n",
    "    def __init__(self):\n",
    "        self.db = DatabasePool()\n",
    "    \n",
    "    async def execute(self, query: str, *args):\n",
    "        async with await self.db.get_connection() as conn:\n",
    "            return await conn.execute(query, *args)\n",
    "    \n",
    "    async def fetch(self, query: str, *args):\n",
    "        async with await self.db.get_connection() as conn:\n",
    "            return await conn.fetch(query, *args)\n",
    "\n",
    "class UserRepo(BaseRepo):\n",
    "    async def get_all(self) -> List[User]:\n",
    "        rows = await self.fetch(\"SELECT * FROM users ORDER BY username\")\n",
    "        return [User(**row) for row in rows]\n",
    "    \n",
    "    async def get_by_id(self, user_id: int) -> Optional[User]:\n",
    "        rows = await self.fetch(\"SELECT * FROM users WHERE id = $1\", user_id)\n",
    "        return User(**rows[0]) if rows else None\n",
    "    \n",
    "    async def get_by_username(self, username: str) -> Optional[User]:\n",
    "        rows = await self.fetch(\"SELECT * FROM users WHERE username = $1\", username)\n",
    "        return User(**rows[0]) if rows else None\n",
    "    \n",
    "    async def create(self, request: CreateUserRequest) -> User:\n",
    "        await self.execute(\n",
    "            \"INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3)\",\n",
    "            request.username, request.email, request.password_hash\n",
    "        )\n",
    "        return await self.get_by_username(request.username)\n",
    "\n",
    "class PostRepo(BaseRepo):\n",
    "    async def get_by_user(self, user_id: int) -> List[Post]:\n",
    "        rows = await self.fetch(\n",
    "            \"SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC\", \n",
    "            user_id\n",
    "        )\n",
    "        return [Post(**row) for row in rows]\n",
    "    \n",
    "    async def create(self, post: Post) -> Post:\n",
    "        await self.execute(\n",
    "            \"INSERT INTO posts (title, content, user_id) VALUES ($1, $2, $3)\",\n",
    "            post.title, post.content, post.user_id\n",
    "        )\n",
    "        return post\n",
    "\n",
    "class CachedUserRepo(UserRepo):\n",
    "    def __init__(self):\n",
    "        super().__init__()\n",
    "        self.cache = {}\n",
    "    \n",
    "    async def get_by_id(self, user_id: int) -> Optional[User]:\n",
    "        if user_id in self.cache:\n",
    "            return self.cache[user_id]\n",
    "        \n",
    "        user = await super().get_by_id(user_id)\n",
    "        if user:\n",
    "            self.cache[user_id] = user\n",
    "        return user\n",
    "''',\n",
    "        \"full_path\": \"/project/api/database.py\"\n",
    "    },\n",
    "    {\n",
    "        \"path\": \"api/models.py\",\n",
    "        \"content\": '''\n",
    "from dataclasses import dataclass\n",
    "from typing import Optional\n",
    "from datetime import datetime\n",
    "\n",
    "@dataclass\n",
    "class User:\n",
    "    id: int\n",
    "    username: str\n",
    "    email: str\n",
    "    password_hash: str\n",
    "    created_at: Optional[datetime] = None\n",
    "    is_active: bool = True\n",
    "    \n",
    "    def display_name(self) -> str:\n",
    "        return f\"@{self.username}\"\n",
    "    \n",
    "    def is_admin(self) -> bool:\n",
    "        return self.username in [\"admin\", \"root\"]\n",
    "\n",
    "@dataclass\n",
    "class Post:\n",
    "    id: int\n",
    "    title: str\n",
    "    content: str\n",
    "    user_id: int\n",
    "    created_at: Optional[datetime] = None\n",
    "    published: bool = True\n",
    "    \n",
    "    def excerpt(self, length: int = 150) -> str:\n",
    "        return self.content[:length] + \"...\" if len(self.content) > length else self.content\n",
    "    \n",
    "    def word_count(self) -> int:\n",
    "        return len(self.content.split())\n",
    "\n",
    "@dataclass\n",
    "class CreateUserRequest:\n",
    "    username: str\n",
    "    email: str\n",
    "    password_hash: str\n",
    "    \n",
    "    def validate(self) -> bool:\n",
    "        return (\n",
    "            len(self.username) >= 3 and\n",
    "            \"@\" in self.email and\n",
    "            len(self.password_hash) > 0\n",
    "        )\n",
    "\n",
    "@dataclass\n",
    "class APIResponse:\n",
    "    success: bool\n",
    "    data: Optional[dict] = None\n",
    "    message: Optional[str] = None\n",
    "    \n",
    "    @classmethod\n",
    "    def ok(cls, data: dict, message: str = \"Success\"):\n",
    "        return cls(success=True, data=data, message=message)\n",
    "    \n",
    "    @classmethod\n",
    "    def error(cls, message: str):\n",
    "        return cls(success=False, message=message)\n",
    "''',\n",
    "        \"full_path\": \"/project/api/models.py\"\n",
    "    }\n",
    "]\n",
    "\n",
    "# Create the graph\n",
    "graph = GraphGenerator(sample_files)\n",
    "search = GraphSearchTool(graph)\n",
    "\n",
    "print(f\"📊 Created graph: {len(search.nodes_map)} nodes, {len(search.edges_list)} edges\")\n",
    "print(f\"📋 Categories: {list(search.get_statistics()['node_categories'].keys())}\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 🎯 The New API: Every Method Returns a Subgraph"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 3,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "🔍 Database search: 46 nodes, 54 edges\n",
      "📋 Node types: ['method', 'method', 'external_symbol', 'method', 'class']\n",
      "✅ Visualization ready!\n"
     ]
    },
    {
     "data": {
      "application/vnd.jupyter.widget-view+json": {
       "model_id": "ce3e325478724778905ac9568118128b",
       "version_major": 2,
       "version_minor": 0
      },
      "text/plain": [
       "Sigma(nx.DiGraph with 46 nodes and 49 edges)"
      ]
     },
     "metadata": {},
     "output_type": "display_data"
    }
   ],
   "source": [
    "# 🔍 Search for database-related code -> returns GraphGenerator\n",
    "db_subgraph = search.fuzzy_search(\"database\", depth=2)\n",
    "\n",
    "print(f\"🔍 Database search: {len(db_subgraph.all_nodes_data)} nodes, {len(db_subgraph.all_edges_data)} edges\")\n",
    "print(f\"📋 Node types: {[n['category'] for n in db_subgraph.all_nodes_data[:5]]}\")\n",
    "\n",
    "# 🎨 Direct visualization (if ipysigma available)\n",
    "try:\n",
    "    db_viz = db_subgraph.visualize(height=400, node_color=\"category\")\n",
    "    print(\"✅ Visualization ready!\")\n",
    "    display(db_viz)\n",
    "except ImportError:\n",
    "    print(\"⚠️ Install ipysigma for visualization: pip install ipysigma\")"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 4,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "🏛️ Classes: 12 nodes\n",
      "   • PostRepo in api/database.py\n",
      "   • Post in api/models.py\n",
      "   • APIResponse in api/models.py\n",
      "   • APIServer in api/server.py\n",
      "   • AuthManager in api/auth.py\n",
      "   • CachedUserRepo in api/database.py\n",
      "   • TokenValidator in api/auth.py\n",
      "   • User in api/models.py\n",
      "   • CreateUserRequest in api/models.py\n",
      "   • UserRepo in api/database.py\n",
      "   • DatabasePool in api/database.py\n",
      "   • BaseRepo in api/database.py\n",
      "\n",
      "✅ Classes visualization:\n"
     ]
    },
    {
     "data": {
      "application/vnd.jupyter.widget-view+json": {
       "model_id": "e9682a33569a48c0a06c238ff9b82c9c",
       "version_major": 2,
       "version_minor": 0
      },
      "text/plain": [
       "Sigma(nx.DiGraph with 12 nodes and 3 edges)"
      ]
     },
     "metadata": {},
     "output_type": "display_data"
    }
   ],
   "source": [
    "# 🏛️ Filter by category -> returns GraphGenerator  \n",
    "classes_subgraph = search.filter_by_category([\"class\"], depth=1)\n",
    "\n",
    "print(f\"🏛️ Classes: {len(classes_subgraph.all_nodes_data)} nodes\")\n",
    "for node in classes_subgraph.all_nodes_data:\n",
    "    if node['category'] == 'class':\n",
    "        print(f\"   • {node['name']} in {node['file']}\")\n",
    "\n",
    "# Direct visualization\n",
    "try:\n",
    "    classes_viz = classes_subgraph.visualize(height=300, node_color=\"category\")\n",
    "    print(\"\\n✅ Classes visualization:\")\n",
    "    display(classes_viz)\n",
    "except ImportError:\n",
    "    print(\"⚠️ Visualization not available\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 🔗 Relationship Analysis"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 5,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "🏗️ Inheritance subgraph: 4 nodes\n",
      "📋 Inheritance relationships found: 4 nodes involved\n",
      "\n",
      "🎨 Inheritance visualization:\n"
     ]
    },
    {
     "data": {
      "application/vnd.jupyter.widget-view+json": {
       "model_id": "240accbe4b2347c5b0ee4f184ecb1d60",
       "version_major": 2,
       "version_minor": 0
      },
      "text/plain": [
       "Sigma(nx.DiGraph with 4 nodes and 3 edges)"
      ]
     },
     "metadata": {},
     "output_type": "display_data"
    }
   ],
   "source": [
    "# Find inheritance relationships -> returns GraphGenerator\n",
    "inheritance_subgraph = search.find_by_relationship([\"inherits\"], depth=1)\n",
    "\n",
    "print(f\"🏗️ Inheritance subgraph: {len(inheritance_subgraph.all_nodes_data)} nodes\")\n",
    "if hasattr(inheritance_subgraph, '_search_metadata'):\n",
    "    centers = inheritance_subgraph._search_metadata.get('center_nodes', [])\n",
    "    print(f\"📋 Inheritance relationships found: {len(centers)} nodes involved\")\n",
    "\n",
    "# Visualize inheritance\n",
    "try:\n",
    "    inherit_viz = inheritance_subgraph.visualize(height=300, node_color=\"category\")\n",
    "    print(\"\\n🎨 Inheritance visualization:\")\n",
    "    display(inherit_viz)\n",
    "except ImportError:\n",
    "    print(\"⚠️ Visualization not available\")"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 6,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "🔗 Neighbors of APIServer: 18 nodes\n",
      "   Direct neighbors: 4\n",
      "\n",
      "🎨 Neighborhood visualization:\n"
     ]
    },
    {
     "data": {
      "application/vnd.jupyter.widget-view+json": {
       "model_id": "e7a3b216eb1744aca3d56fc5377775f0",
       "version_major": 2,
       "version_minor": 0
      },
      "text/plain": [
       "Sigma(nx.DiGraph with 18 nodes and 17 edges)"
      ]
     },
     "metadata": {},
     "output_type": "display_data"
    }
   ],
   "source": [
    "# Get neighbors of a specific node -> returns GraphGenerator\n",
    "api_server_id = \"api.server.APIServer\"\n",
    "neighbors_subgraph = search.get_neighbors(api_server_id, depth=2)\n",
    "\n",
    "print(f\"🔗 Neighbors of APIServer: {len(neighbors_subgraph.all_nodes_data)} nodes\")\n",
    "if hasattr(neighbors_subgraph, '_search_metadata'):\n",
    "    neighbor_count = neighbors_subgraph._search_metadata.get('neighbor_count', 0)\n",
    "    print(f\"   Direct neighbors: {neighbor_count}\")\n",
    "\n",
    "# Visualize neighborhood\n",
    "try:\n",
    "    neighbors_viz = neighbors_subgraph.visualize(height=350, node_color=\"category\")\n",
    "    print(\"\\n🎨 Neighborhood visualization:\")\n",
    "    display(neighbors_viz)\n",
    "except ImportError:\n",
    "    print(\"⚠️ Visualization not available\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 🧠 LLM Context Generation from Subgraphs"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 7,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "🤖 Single subgraph LLM context:\n",
      "==================================================\n",
      "# Search Result 1: fuzzy_search\n",
      "Query: 'auth'\n",
      "Nodes: 20, Edges: 12\n",
      "\n",
      "Module {api.server.APIServer.__init__}\n",
      "File: api/server.py\n",
      "Defines:\n",
      "\n",
      "__init__ (method) — lines 8–12\n",
      "Relationship: api.server.APIServer → api.server.APIServer.__init__ (defines_method)\n",
      "Relationship: api.server.APIServer.__init__ → fastapi.FastAPI (calls)\n",
      "Relationship: api.server.APIServer.__init__ → auth.AuthManager (calls)\n",
      "\n",
      "Code:\n",
      "\n",
      "```\n",
      "def __init__(self):\n",
      "    self.app = FastAPI(title='Blog API')\n",
      "    self.auth = AuthManager()\n",
      "    self.user_repo = UserRepo()\n",
      "    self.post_repo = PostRepo()\n",
      "```\n",
      "\n",
      "\\\n",
      "Module {conn.execute}\n",
      "File: None\n",
      "...\n",
      "==================================================\n"
     ]
    }
   ],
   "source": [
    "# Generate context from single subgraph\n",
    "auth_subgraph = search.fuzzy_search(\"auth\", depth=1)\n",
    "single_context = GraphSearchTool.build_llm_context(auth_subgraph, include_code=True)\n",
    "\n",
    "print(\"🤖 Single subgraph LLM context:\")\n",
    "print(\"=\" * 50)\n",
    "print(single_context[:600] + \"...\" if len(single_context) > 600 else single_context)\n",
    "print(\"=\" * 50)"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 8,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "🤖 Multi-subgraph context: 25669 characters\n",
      "\n",
      "📋 Context preview (first 800 chars):\n",
      "==================================================\n",
      "# Search Result 1: fuzzy_search\n",
      "Query: 'database'\n",
      "Nodes: 46, Edges: 54\n",
      "\n",
      "Module {api.database.BaseRepo.__init__}\n",
      "File: api/database.py\n",
      "Defines:\n",
      "\n",
      "__init__ (method) — lines 18–19\n",
      "Relationship: api.database.BaseRepo → api.database.BaseRepo.__init__ (defines_method)\n",
      "Relationship: api.database.BaseRepo.__init__ → api.database.DatabasePool (calls)\n",
      "\n",
      "Code:\n",
      "\n",
      "```\n",
      "def __init__(self):\n",
      "    self.db = DatabasePool()\n",
      "```\n",
      "\n",
      "\\\n",
      "Module {api.database.CachedUserRepo.__init__}\n",
      "File: api/database.py\n",
      "Defines:\n",
      "\n",
      "__init__ (method) — lines 65–67\n",
      "Relationship: api.database.CachedUserRepo → api.database.CachedUserRepo.__init__ (defines_method)\n",
      "Relationship: api.database.CachedUserRepo.__init__ → super().__init__ (calls)\n",
      "\n",
      "Code:\n",
      "\n",
      "```\n",
      "def __init__(self):\n",
      "    super().__init__()\n",
      "    self.cache = {}\n",
      "```\n",
      "\n",
      "\\\n",
      "Module {conn.execute}...\n",
      "==================================================\n"
     ]
    }
   ],
   "source": [
    "# Generate context from multiple subgraphs\n",
    "multi_context = GraphSearchTool.build_llm_context([\n",
    "    db_subgraph,\n",
    "    classes_subgraph, \n",
    "    auth_subgraph\n",
    "], include_code=True, max_code_length=200)\n",
    "\n",
    "print(f\"🤖 Multi-subgraph context: {len(multi_context)} characters\")\n",
    "print(\"\\n📋 Context preview (first 800 chars):\")\n",
    "print(\"=\" * 50)\n",
    "print(multi_context[:800] + \"...\")\n",
    "print(\"=\" * 50)"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 🔄 Chaining Operations"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 9,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "🔍 Original graph: 67 nodes\n",
      "📊 Database subgraph: 46 nodes\n",
      "🎯 User search in DB subgraph: 20 nodes\n",
      "\n",
      "🎨 Chained search visualization:\n"
     ]
    },
    {
     "data": {
      "application/vnd.jupyter.widget-view+json": {
       "model_id": "7d48054b8b9649e983e6005ecbeb6a17",
       "version_major": 2,
       "version_minor": 0
      },
      "text/plain": [
       "Sigma(nx.DiGraph with 20 nodes and 16 edges)"
      ]
     },
     "metadata": {},
     "output_type": "display_data"
    }
   ],
   "source": [
    "# Create new search tool from database subgraph\n",
    "db_search = GraphSearchTool(db_subgraph)\n",
    "\n",
    "# Search within the database subgraph\n",
    "user_in_db = db_search.fuzzy_search(\"user\", depth=1)\n",
    "\n",
    "print(f\"🔍 Original graph: {len(search.nodes_map)} nodes\")\n",
    "print(f\"📊 Database subgraph: {len(db_subgraph.all_nodes_data)} nodes\")\n",
    "print(f\"🎯 User search in DB subgraph: {len(user_in_db.all_nodes_data)} nodes\")\n",
    "\n",
    "# Visualize the focused search result\n",
    "try:\n",
    "    chain_viz = user_in_db.visualize(height=300, node_color=\"category\")\n",
    "    print(\"\\n🎨 Chained search visualization:\")\n",
    "    display(chain_viz)\n",
    "except ImportError:\n",
    "    print(\"⚠️ Visualization not available\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 🔥 Advanced Analysis"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 10,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "🔥 Complexity hotspots: 18 nodes\n",
      "\n",
      "📊 Top connected nodes:\n",
      "   • api.server.APIServer.setup_routes: 8 connections\n",
      "   • api.auth.AuthManager: 7 connections\n",
      "   • api.database.BaseRepo: 7 connections\n",
      "\n",
      "🎨 Complexity hotspots visualization:\n"
     ]
    },
    {
     "data": {
      "application/vnd.jupyter.widget-view+json": {
       "model_id": "5f5048fac4db4aa88ef5aa7c0e07298a",
       "version_major": 2,
       "version_minor": 0
      },
      "text/plain": [
       "Sigma(nx.DiGraph with 18 nodes and 19 edges)"
      ]
     },
     "metadata": {},
     "output_type": "display_data"
    }
   ],
   "source": [
    "# Find complexity hotspots -> returns GraphGenerator\n",
    "hotspots_subgraph = search.get_high_connectivity_nodes(min_connections=3, depth=1)\n",
    "\n",
    "print(f\"🔥 Complexity hotspots: {len(hotspots_subgraph.all_nodes_data)} nodes\")\n",
    "if hasattr(hotspots_subgraph, '_search_metadata'):\n",
    "    details = hotspots_subgraph._search_metadata.get('connectivity_details', [])\n",
    "    print(\"\\n📊 Top connected nodes:\")\n",
    "    for detail in details[:3]:\n",
    "        print(f\"   • {detail['node_id']}: {detail['connections']} connections\")\n",
    "\n",
    "# Visualize hotspots\n",
    "try:\n",
    "    hotspots_viz = hotspots_subgraph.visualize(height=350, node_color=\"category\")\n",
    "    print(\"\\n🎨 Complexity hotspots visualization:\")\n",
    "    display(hotspots_viz)\n",
    "except ImportError:\n",
    "    print(\"⚠️ Visualization not available\")"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 11,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "🛤️ Paths between api.server.APIServer and api.auth.AuthManager:\n",
      "   Subgraph: 0 nodes\n",
      "   Found 0 paths:\n",
      "\n",
      "🎨 Paths visualization:\n"
     ]
    },
    {
     "data": {
      "application/vnd.jupyter.widget-view+json": {
       "model_id": "6fc983de9a5240c3947158b8255be2a6",
       "version_major": 2,
       "version_minor": 0
      },
      "text/plain": [
       "Sigma(nx.DiGraph with 0 nodes and 0 edges)"
      ]
     },
     "metadata": {},
     "output_type": "display_data"
    }
   ],
   "source": [
    "# Find paths between components -> returns GraphGenerator\n",
    "if len(search.nodes_map) >= 2:\n",
    "    node_list = list(search.nodes_map.keys())\n",
    "    source = \"api.server.APIServer\"\n",
    "    target = \"api.auth.AuthManager\"\n",
    "    \n",
    "    paths_subgraph = search.find_paths(source, target, max_paths=3)\n",
    "    \n",
    "    print(f\"🛤️ Paths between {source} and {target}:\")\n",
    "    print(f\"   Subgraph: {len(paths_subgraph.all_nodes_data)} nodes\")\n",
    "    \n",
    "    if hasattr(paths_subgraph, '_search_metadata'):\n",
    "        paths_found = paths_subgraph._search_metadata.get('paths_found', [])\n",
    "        print(f\"   Found {len(paths_found)} paths:\")\n",
    "        for i, path in enumerate(paths_found, 1):\n",
    "            print(f\"   Path {i}: {' → '.join(path)}\")\n",
    "    \n",
    "    # Visualize paths\n",
    "    try:\n",
    "        paths_viz = paths_subgraph.visualize(height=300, node_color=\"category\")\n",
    "        print(\"\\n🎨 Paths visualization:\")\n",
    "        display(paths_viz)\n",
    "    except ImportError:\n",
    "        print(\"⚠️ Visualization not available\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 📊 Statistics and Summary"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 12,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "📈 Graph Statistics:\n",
      "   Total nodes: 67\n",
      "   Total edges: 80\n",
      "   Average connectivity: 2.39\n",
      "   Connected components: 1\n",
      "\n",
      "📊 Node categories:\n",
      "   directory: 1 (1.5%)\n",
      "   module: 4 (6.0%)\n",
      "   class: 12 (17.9%)\n",
      "   method: 19 (28.4%)\n",
      "   external_symbol: 31 (46.3%)\n",
      "\n",
      "🔗 Relationship types:\n",
      "   contains_module: 4\n",
      "   defines_class: 12\n",
      "   defines_method: 19\n",
      "   calls: 42\n",
      "   inherits: 3\n"
     ]
    }
   ],
   "source": [
    "# Get comprehensive statistics\n",
    "stats = search.get_statistics()\n",
    "\n",
    "print(\"📈 Graph Statistics:\")\n",
    "print(f\"   Total nodes: {stats['total_nodes']}\")\n",
    "print(f\"   Total edges: {stats['total_edges']}\")\n",
    "print(f\"   Average connectivity: {stats['average_degree']:.2f}\")\n",
    "print(f\"   Connected components: {stats['weakly_connected_components']}\")\n",
    "\n",
    "print(\"\\n📊 Node categories:\")\n",
    "for category, count in stats['node_categories'].items():\n",
    "    percentage = (count / stats['total_nodes']) * 100\n",
    "    print(f\"   {category}: {count} ({percentage:.1f}%)\")\n",
    "\n",
    "print(\"\\n🔗 Relationship types:\")\n",
    "for rel_type, count in stats['relationship_types'].items():\n",
    "    print(f\"   {rel_type}: {count}\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 🎉 API Benefits Demo"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 13,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "✨ NEW API BENEFITS:\n",
      "==================================================\n",
      "\n",
      "🎯 Every method returns GraphGenerator:\n",
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "   search.fuzzy_search('database') → GraphGenerator\n",
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "   search.filter_by_category(['class']) → GraphGenerator\n",
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "   search.get_neighbors(...) → GraphGenerator\n",
      "\n",
      "🎨 Direct visualization:\n",
      "   subgraph.visualize()  # Works immediately!\n",
      "\n",
      "🔄 Easy chaining:\n",
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "   GraphSearchTool(db_result).fuzzy_search('user') → 14 nodes\n",
      "\n",
      "🤖 LLM context generation:\n",
      "   build_llm_context([subgraph1, subgraph2]) → 13516 chars\n",
      "\n",
      "✅ No boilerplate code needed!\n",
      "✅ Consistent API across all methods!\n",
      "✅ Chainable and composable!\n",
      "✅ Ready for visualization!\n"
     ]
    }
   ],
   "source": [
    "print(\"✨ NEW API BENEFITS:\")\n",
    "print(\"=\"*50)\n",
    "print()\n",
    "\n",
    "print(\"🎯 Every method returns GraphGenerator:\")\n",
    "db_result = search.fuzzy_search(\"database\")\n",
    "print(f\"   search.fuzzy_search('database') → {type(db_result).__name__}\")\n",
    "\n",
    "class_result = search.filter_by_category(['class'])\n",
    "print(f\"   search.filter_by_category(['class']) → {type(class_result).__name__}\")\n",
    "\n",
    "neighbor_result = search.get_neighbors('api.server.APIServer')\n",
    "print(f\"   search.get_neighbors(...) → {type(neighbor_result).__name__}\")\n",
    "\n",
    "print(\"\\n🎨 Direct visualization:\")\n",
    "print(\"   subgraph.visualize()  # Works immediately!\")\n",
    "\n",
    "print(\"\\n🔄 Easy chaining:\")\n",
    "chained = GraphSearchTool(db_result).fuzzy_search('user')\n",
    "print(f\"   GraphSearchTool(db_result).fuzzy_search('user') → {len(chained.all_nodes_data)} nodes\")\n",
    "\n",
    "print(\"\\n🤖 LLM context generation:\")\n",
    "context = GraphSearchTool.build_llm_context([db_result, class_result])\n",
    "print(f\"   build_llm_context([subgraph1, subgraph2]) → {len(context)} chars\")\n",
    "\n",
    "print(\"\\n✅ No boilerplate code needed!\")\n",
    "print(\"✅ Consistent API across all methods!\")\n",
    "print(\"✅ Chainable and composable!\")\n",
    "print(\"✅ Ready for visualization!\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 📝 Summary\n",
    "\n",
    "### ✨ Key Features:\n",
    "\n",
    "- **🎯 Consistent API**: Every method returns a `GraphGenerator` subgraph\n",
    "- **🎨 Direct Visualization**: Call `.visualize()` on any result\n",
    "- **🔄 Chainable**: Use subgraphs as input to new `GraphSearchTool` instances\n",
    "- **🤖 LLM Ready**: Generate formatted context from single or multiple subgraphs\n",
    "- **🔍 Rich Search**: Fuzzy search, category filters, relationship analysis\n",
    "- **🛤️ Path Analysis**: Find connections between components\n",
    "- **🔥 Complexity Analysis**: Identify hotspots and high-connectivity nodes\n",
    "\n",
    "### 🚀 Usage Pattern:\n",
    "\n",
    "```python\n",
    "# Search\n",
    "subgraph = search.fuzzy_search(\"database\")\n",
    "\n",
    "# Visualize\n",
    "subgraph.visualize()\n",
    "\n",
    "# Chain\n",
    "focused = GraphSearchTool(subgraph).fuzzy_search(\"user\")\n",
    "\n",
    "# Generate context\n",
    "context = GraphSearchTool.build_llm_context([subgraph, focused])\n",
    "```\n",
    "\n",
    "**Clean, simple, powerful!** 🎉"
   ]
  }
 ],
 "metadata": {
  "kernelspec": {
   "display_name": "base",
   "language": "python",
   "name": "python3"
  },
  "language_info": {
   "codemirror_mode": {
    "name": "ipython",
    "version": 3
   },
   "file_extension": ".py",
   "mimetype": "text/x-python",
   "name": "python",
   "nbconvert_exporter": "python",
   "pygments_lexer": "ipython3",
   "version": "3.12.9"
  }
 },
 "nbformat": 4,
 "nbformat_minor": 4
}
