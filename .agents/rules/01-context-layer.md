# CONTEXT LAYER - Load khi bat dau code

## Coding (tham chieu, khong copy)
-> Tuan thu `docs/CONVENTIONS.md` (doc khi can, khong load mac dinh)

## Platform (Auto-detect)
AI tu dong nhan dien OS cua user va dieu chinh:
- **Windows**: Dung `cmd /c` prefix cho shell commands
- **macOS**: Dung Terminal truc tiep (zsh/bash), `python3` thay vi `python`
- **Path**: Dung separator phu hop OS (`\` Windows, `/` Mac/Linux)

## Memory Protocol
- Doc full memory-bank: CHI khi bat dau session hoac khi bi lac context
- Binh thuong: Chi doc activeContext.md (lightweight)
- REPO_GRAPH.md: Doc khi can navigate codebase, KHONG doc mac dinh
- CONTEXT_INDEX.md: Tra cuu TRUOC khi doc bat ky .context/ file nao
