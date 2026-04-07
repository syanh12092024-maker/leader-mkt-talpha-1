---
description: Auto-deploy lên Vercel production (commit + push + deploy)
---

# Deploy Workflow

Quy trình tự động deploy code lên Vercel production.

// turbo-all

## Steps

1. Build project để kiểm tra lỗi trước khi deploy
```bash
cd "/Users/macbook/Desktop/LEADER MKT TALPHA" && npm run build 2>&1 | tail -10
```

2. Commit tất cả thay đổi
```bash
cd "/Users/macbook/Desktop/LEADER MKT TALPHA" && git add -A && git status --short
```

3. Tạo commit message mô tả thay đổi
```bash
cd "/Users/macbook/Desktop/LEADER MKT TALPHA" && git commit -m "<mô tả thay đổi>"
```

4. Push lên GitHub
```bash
cd "/Users/macbook/Desktop/LEADER MKT TALPHA" && git push origin main
```

5. Deploy production lên Vercel
```bash
cd "/Users/macbook/Desktop/LEADER MKT TALPHA" && npx -y vercel --prod
```

6. Xác nhận deploy thành công — báo lại URL cho user
