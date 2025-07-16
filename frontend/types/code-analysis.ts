export interface CodeReference {
  id: string;
  name: string;
  file: string;
  code: string;
  category: string;
  start_line?: number;
  end_line?: number;
}

export interface GraphData {
  nodes: CodeReference[];
  edges: Array<{
    source: string;
    target: string;
    relationship?: string;
  }>;
}

export interface Usage {
  line: number;
  column: number;
  type: 'call' | 'import' | 'method' | 'property' | 'constructor' | 'export';
  context: string;
  fullContext: string;
  functionScope?: string;
  usagePattern: string;
}

export interface ReferenceFile {
  file: string;
  fileName: string;
  relativePath: string;
  usages: Usage[];
  totalUsages: number;
  referencingNodes: CodeReference[];
}

export interface ReferenceChain {
  depth: number;
  node: CodeReference;
  usages: Usage[];
  children: ReferenceChain[];
}

export interface CodeReferenceProps {
  selectedNode: CodeReference;
  graphData: GraphData;
  maxDepth?: number;
  onOpenFile: (filePath: string, line?: number) => void;
}
