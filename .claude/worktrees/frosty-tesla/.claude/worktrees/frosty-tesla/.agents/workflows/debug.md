---
description: Debugger Checklist V5.1 - Root Cause Interview
---

## Phase 0: Gatekeeper
User mo ta bug -> Kernel chay Gap Score
Neu mo ta qua mo ho (Gap > 40%) -> HOI:
- Bug xay ra o man hinh/endpoint nao?
- Co error message cu the khong?
- Lan cuoi no hoat dong dung la khi nao?

## Phase 1: Investigate
1. Doc activeContext.md + REPO_GRAPH.md
2. Tra CONTEXT_INDEX.md -> context lien quan
3. Doc error logs (docker logs, pm2 logs, terminal)

## Phase 2: Mental Sandbox
4. Trace REPO_GRAPH nguoc tu bug location
5. Tao bang Impact Analysis

## Phase 3: Root Cause Interview
6. Tao max 3 gia thuyet voi confidence level
7. Test gia thuyet confidence cao nhat truoc

## Phase 4: Fix + Verify
8. Fix bug (minimal change). Rui ro cao -> PoC truoc
9. Chay tests verify + kiem tra regression

## Phase 5: Document
10. Ghi milestone. Cap nhat progress.md
