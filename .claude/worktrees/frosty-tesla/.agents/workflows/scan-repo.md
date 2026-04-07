---
description: Auto-scan codebase va generate REPO_GRAPH.md
---
// turbo-all
1. Dung find_by_name de list tat ca source files trong src/
2. Voi moi file chinh, chay view_file_outline de lay functions/classes
3. Dung grep_search 'import|require' de tim dependency relationships
4. Tao bang Nodes: moi module 1 row (name, path, type, exports)
5. Tao bang Edges: moi relationship 1 row (from, to, type)
6. Ghi ket qua vao REPO_GRAPH.md (overwrite)
