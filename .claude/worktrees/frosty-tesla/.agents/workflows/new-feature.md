---
description: Builder Checklist V5.1 - voi Mental Sandbox va PoC Protocol
---

## Phase 0: Gatekeeper (tu dong)
- Kiem tra Fast-Track: fix typo / <=1 file <=10 dong -> code ngay
- Kernel chay Context Gap Score
- Neu Gap > 20% -> redirect sang /refine-intent truoc

## Phase 0b: Doc lai Master Prompt (neu co)
- Kiem tra .context/current/{task-name}.md co ton tai khong
- Neu co -> doc lai de dam bao khong troi context

## Phase 1: Context Loading
1. Doc activeContext.md
2. Tra CONTEXT_INDEX.md -> load relevant contexts
3. Doc REPO_GRAPH.md -> modules lien quan

## Phase 2: Mental Sandbox (BAT BUOC)
// turbo-all
4. Liet ke tat ca files se bi thay doi
5. Trace trong REPO_GRAPH bang TOOL THUC TE (grep_search, view_file_outline):
   - File nao IMPORT file nay? Co bi break khong?
   - Shared utilities nao bi anh huong?
6. Tao bang Side-Effect Analysis (PHAI co cot Verified By):
   | File thay doi | Files bi anh huong | Rui ro | Muc do | Verified By |
   Verified By = ten tool da dung (grep_search, view_file_outline, etc.)
   Neu Verified By trong -> side-effect la GIA DINH, KHONG duoc danh gia High.
7. DANH GIA RUI RO:
   - Neu co >= 1 muc High (DA VERIFIED) -> DE XUAT tao PoC.md truoc
   - Neu tat ca Low/Med -> tiep Phase 3

## Phase 2b: PoC Protocol (khi rui ro cao)
8. Tao file docs/poc/{feature-name}-poc.md
9. Gui PoC cho user review -> approve -> tiep Phase 3

## Phase 3: Implementation Plan
10. Tao plan artifact -> cho user approve

## Phase 4: Execution
11. Code theo plan + Sentinel checks song song
12. Sau moi milestone -> ghi vao activeContext

## Phase 5: Post-flight
13. Cap nhat progress.md, REPO_GRAPH.md, CONTEXT_INDEX.md
