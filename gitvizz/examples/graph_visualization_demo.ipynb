{
 "cells": [
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "# GitVizz Graph Visualization Demo\n",
    "\n",
    "This notebook demonstrates the new graph loading, saving, and visualization features of GitVizz."
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 1,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "ipysigma available: True\n"
     ]
    }
   ],
   "source": [
    "import sys\n",
    "sys.path.append('..')\n",
    "\n",
    "from gitvizz import GraphGenerator, IPYSIGMA_AVAILABLE\n",
    "import zipfile\n",
    "import os\n",
    "import tempfile\n",
    "import urllib.request\n",
    "from pathlib import Path\n",
    "\n",
    "# GitHub zip URL for the example repository\n",
    "GITHUB_ZIP_URL = \"https://github.com/adithya-s-k/omniparse/archive/refs/heads/main.zip\"\n",
    "\n",
    "print(f\"ipysigma available: {IPYSIGMA_AVAILABLE}\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 1. NEW: Load and Analyze Repository Directly from ZIP or Folder\n",
    "\n",
    "GitVizz now supports loading directly from ZIP files or directories with the convenient `from_source()` method!"
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
      "📦 Downloading ZIP from GitHub...\n",
      "✅ Successfully downloaded to: /var/folders/m4/wjv39knd26bdfj61bssrwj3c0000gn/T/tmpnfb4bzex.zip\n",
      "Loaded 30 files from /var/folders/m4/wjv39knd26bdfj61bssrwj3c0000gn/T/tmpnfb4bzex.zip\n",
      "GraphGenerator: Determined project root: /private/var/folders/m4/wjv39knd26bdfj61bssrwj3c0000gn/T\n",
      "Identified project type: python\n",
      "✅ Analysis complete:\n",
      "   - Nodes: 509\n",
      "   - Edges: 1159\n",
      "   - Project type: python\n",
      "✅ Cleaned up temporary zip file\n"
     ]
    }
   ],
   "source": [
    "# NEW: Create GraphGenerator directly from ZIP file or directory!\n",
    "# No more manual extraction and file loading required - now with dynamic GitHub download!\n",
    "\n",
    "# Create a temporary file to store the downloaded zip\n",
    "with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp_zip:\n",
    "    try:\n",
    "        print(f\"📦 Downloading ZIP from GitHub...\")\n",
    "        urllib.request.urlretrieve(GITHUB_ZIP_URL, temp_zip.name)\n",
    "        zip_path = temp_zip.name\n",
    "        print(f\"✅ Successfully downloaded to: {zip_path}\")\n",
    "        \n",
    "        # Create generator directly from ZIP - much simpler!\n",
    "        generator = GraphGenerator.from_source(\n",
    "            zip_path,\n",
    "            # max_files=25,  # Limit files for demo performance\n",
    "            file_extensions=['.py']  # Only Python files for this demo\n",
    "        )\n",
    "        \n",
    "        # Generate and analyze\n",
    "        graph_data = generator.generate()\n",
    "        print(\"✅ Analysis complete:\")\n",
    "        print(f\"   - Nodes: {len(graph_data['nodes'])}\")\n",
    "        print(f\"   - Edges: {len(graph_data['edges'])}\")\n",
    "        print(f\"   - Project type: {generator.project_type}\")\n",
    "        \n",
    "    except Exception as e:\n",
    "        print(f\"❌ Failed to process ZIP: {e}\")\n",
    "    finally:\n",
    "        # Clean up the temporary zip file\n",
    "        if os.path.exists(zip_path):\n",
    "            os.unlink(zip_path)\n",
    "            print(\"✅ Cleaned up temporary zip file\")"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 8,
   "metadata": {},
   "outputs": [],
   "source": [
    "# # Demonstrate directory loading as well\n",
    "# print(\"\\\\n📁 Loading from directory example:\")\n",
    "\n",
    "# # Load from a directory instead of ZIP\n",
    "# try:\n",
    "#     generator_from_dir = GraphGenerator.from_source(\n",
    "#         '../gitvizz',  # Load the GitVizz package itself\n",
    "#         file_extensions=['.py'],\n",
    "#         ignore_patterns=[\n",
    "#             # '**/__pycache__/**',\n",
    "#             # '**/.*',  # Hidden files\n",
    "#             # '**/test_*',  # Test files\n",
    "#             # '**/*.pyc'\n",
    "#         ],\n",
    "#         # max_files=5  # Keep it small for demo\n",
    "#     )\n",
    "    \n",
    "#     dir_graph = generator_from_dir.generate()\n",
    "#     print(f\"✅ Directory analysis:\")\n",
    "#     print(f\"   - Nodes: {len(dir_graph['nodes'])}\")\n",
    "#     print(f\"   - Edges: {len(dir_graph['edges'])}\")\n",
    "#     print(f\"   - Project type: {generator_from_dir.project_type}\")\n",
    "    \n",
    "# except Exception as e:\n",
    "#     print(f\"❌ Directory loading failed: {e}\")\n",
    "\n",
    "# print(\"\\\\n🎉 The from_source() method makes GitVizz much easier to use!\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 3. Save and Load Graph in Different Formats"
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
      "Saved graph to graph_data.json\n",
      "Saved graph to graph_data.graphml\n"
     ]
    }
   ],
   "source": [
    "# Save graph in JSON format\n",
    "generator.save_json(\"graph_data.json\")\n",
    "print(\"Saved graph to graph_data.json\")\n",
    "\n",
    "# Save graph in GraphML format\n",
    "generator.save_graphml(\"graph_data.graphml\")\n",
    "print(\"Saved graph to graph_data.graphml\")"
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
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "Loaded from JSON: 509 nodes, 1159 edges\n",
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "Loaded from GraphML: 509 nodes, 781 edges\n"
     ]
    }
   ],
   "source": [
    "# Test loading from JSON\n",
    "new_generator_json = GraphGenerator([])\n",
    "new_generator_json.load_json(\"graph_data.json\")\n",
    "print(f\"Loaded from JSON: {len(new_generator_json.all_nodes_data)} nodes, {len(new_generator_json.all_edges_data)} edges\")\n",
    "\n",
    "# Test loading from GraphML\n",
    "new_generator_graphml = GraphGenerator([])\n",
    "new_generator_graphml.load_graphml(\"graph_data.graphml\")\n",
    "print(f\"Loaded from GraphML: {len(new_generator_graphml.all_nodes_data)} nodes, {len(new_generator_graphml.all_edges_data)} edges\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 4. Convert to NetworkX"
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
      "NetworkX graph: 509 nodes, 781 edges\n",
      "Graph type: <class 'networkx.classes.digraph.DiGraph'>\n",
      "Graph properties:\n",
      "- Is directed: True\n",
      "- Number of weakly connected components: 1\n",
      "Top 5 nodes by degree:\n",
      "- get_content_of_website (function): 31\n",
      "- demo (module): 30\n",
      "- router (module): 26\n",
      "- utils (module): 19\n",
      "- model_loader (module): 18\n"
     ]
    }
   ],
   "source": [
    "# Convert to NetworkX graph\n",
    "import networkx as nx\n",
    "nx_graph = generator.to_networkx()\n",
    "print(f\"NetworkX graph: {nx_graph.number_of_nodes()} nodes, {nx_graph.number_of_edges()} edges\")\n",
    "print(f\"Graph type: {type(nx_graph)}\")\n",
    "\n",
    "# Show some basic NetworkX analysis\n",
    "print(\"Graph properties:\")\n",
    "print(f\"- Is directed: {nx_graph.is_directed()}\")\n",
    "print(f\"- Number of weakly connected components: {nx.number_weakly_connected_components(nx_graph)}\")\n",
    "\n",
    "# Show top 5 nodes by degree\n",
    "degrees = dict(nx_graph.degree())\n",
    "top_nodes = sorted(degrees.items(), key=lambda x: x[1], reverse=True)[:5]\n",
    "print(\"Top 5 nodes by degree:\")\n",
    "for node_id, degree in top_nodes:\n",
    "    node_data = nx_graph.nodes[node_id]\n",
    "    print(f\"- {node_data.get('name', node_id)} ({node_data.get('category', 'unknown')}): {degree}\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 5. Interactive Visualization with ipysigma"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 15,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "ipysigma is available - creating interactive visualization\n"
     ]
    },
    {
     "data": {
      "application/vnd.jupyter.widget-view+json": {
       "model_id": "e2457cdfac78469fa8a79b86dd7b0365",
       "version_major": 2,
       "version_minor": 0
      },
      "text/plain": [
       "Sigma(nx.DiGraph with 509 nodes and 781 edges)"
      ]
     },
     "metadata": {},
     "output_type": "display_data"
    }
   ],
   "source": [
    "# Check if ipysigma is available\n",
    "if IPYSIGMA_AVAILABLE:\n",
    "    print(\"ipysigma is available - creating interactive visualization\")\n",
    "    \n",
    "    # Create interactive visualization\n",
    "    sigma_widget = generator.visualize(\n",
    "        width=1000,\n",
    "        height=700\n",
    "    )\n",
    "    \n",
    "    # Display the widget\n",
    "    display(sigma_widget)\n",
    "else:\n",
    "    print(\"ipysigma is not available. Install it with: pip install ipysigma\")\n",
    "    print(\"Falling back to basic NetworkX visualization\")\n",
    "    \n",
    "    import matplotlib.pyplot as plt\n",
    "    plt.figure(figsize=(12, 8))\n",
    "    \n",
    "    # Simple NetworkX layout\n",
    "    pos = nx.spring_layout(nx_graph, k=1, iterations=50)\n",
    "    \n",
    "    # Draw nodes colored by category\n",
    "    categories = set()\n",
    "    for node_id in nx_graph.nodes():\n",
    "        categories.add(nx_graph.nodes[node_id].get('category', 'unknown'))\n",
    "    \n",
    "    colors = plt.cm.Set3(range(len(categories)))\n",
    "    category_color_map = dict(zip(categories, colors))\n",
    "    \n",
    "    for category in categories:\n",
    "        nodes_in_category = [n for n in nx_graph.nodes() \n",
    "                           if nx_graph.nodes[n].get('category') == category]\n",
    "        nx.draw_networkx_nodes(nx_graph, pos, \n",
    "                              nodelist=nodes_in_category,\n",
    "                              node_color=[category_color_map[category]],\n",
    "                              label=category, node_size=100)\n",
    "    \n",
    "    nx.draw_networkx_edges(nx_graph, pos, alpha=0.3, arrows=True)\n",
    "    plt.legend()\n",
    "    plt.title(\"Repository Dependency Graph\")\n",
    "    plt.axis('off')\n",
    "    plt.tight_layout()\n",
    "    plt.show()"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 6. Advanced ipysigma Customization (if available)"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 16,
   "metadata": {},
   "outputs": [
    {
     "data": {
      "application/vnd.jupyter.widget-view+json": {
       "model_id": "f7a0d08531794c79b8f13c490bc2fccd",
       "version_major": 2,
       "version_minor": 0
      },
      "text/plain": [
       "Sigma(nx.DiGraph with 509 nodes and 781 edges)"
      ]
     },
     "metadata": {},
     "output_type": "display_data"
    }
   ],
   "source": [
    "if IPYSIGMA_AVAILABLE:\n",
    "    # Custom visualization with degree-based sizing\n",
    "    degrees = dict(nx_graph.degree())\n",
    "    \n",
    "    sigma_custom = generator.visualize(\n",
    "        node_size=degrees,  # Size nodes by degree\n",
    "        node_color='category',  # Color by category (default)\n",
    "        width=1200,\n",
    "        height=800\n",
    "    )\n",
    "    \n",
    "    display(sigma_custom)\n",
    "else:\n",
    "    print(\"ipysigma not available for custom visualization\")"
   ]
  },
  {
   "cell_type": "markdown",
   "metadata": {},
   "source": [
    "## 7. File Format Interoperability Test"
   ]
  },
  {
   "cell_type": "code",
   "execution_count": 17,
   "metadata": {},
   "outputs": [
    {
     "name": "stdout",
     "output_type": "stream",
     "text": [
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "GraphGenerator: Determined project root: /Users/adithyaskolavi/projects/git-repo-mcp/gitvizz/examples\n",
      "Identified project type: unknown\n",
      "Round-trip test results:\n",
      "Original: 509 nodes, 1159 edges\n",
      "From JSON: 509 nodes, 1159 edges\n",
      "From GraphML: 509 nodes, 781 edges\n",
      "Cleaned up test_original.json\n",
      "Cleaned up test_roundtrip.graphml\n"
     ]
    }
   ],
   "source": [
    "# Test round-trip conversion: Original -> JSON -> NetworkX -> GraphML -> Back to GitVizz\n",
    "\n",
    "# 1. Save original to JSON\n",
    "generator.save_json(\"test_original.json\")\n",
    "\n",
    "# 2. Load from JSON into new instance\n",
    "gen_from_json = GraphGenerator([])\n",
    "gen_from_json.load_json(\"test_original.json\")\n",
    "\n",
    "# 3. Convert to NetworkX and save as GraphML\n",
    "nx_from_json = gen_from_json.to_networkx()\n",
    "gen_from_json.save_graphml(\"test_roundtrip.graphml\")\n",
    "\n",
    "# 4. Load GraphML back into new instance\n",
    "gen_from_graphml = GraphGenerator([])\n",
    "gen_from_graphml.load_graphml(\"test_roundtrip.graphml\")\n",
    "\n",
    "# 5. Compare results\n",
    "print(\"Round-trip test results:\")\n",
    "print(f\"Original: {len(generator.all_nodes_data)} nodes, {len(generator.all_edges_data)} edges\")\n",
    "print(f\"From JSON: {len(gen_from_json.all_nodes_data)} nodes, {len(gen_from_json.all_edges_data)} edges\")\n",
    "print(f\"From GraphML: {len(gen_from_graphml.all_nodes_data)} nodes, {len(gen_from_graphml.all_edges_data)} edges\")\n",
    "\n",
    "# Cleanup test files\n",
    "for file in [\"test_original.json\", \"test_roundtrip.graphml\"]:\n",
    "    if os.path.exists(file):\n",
    "        os.remove(file)\n",
    "        print(f\"Cleaned up {file}\")"
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
