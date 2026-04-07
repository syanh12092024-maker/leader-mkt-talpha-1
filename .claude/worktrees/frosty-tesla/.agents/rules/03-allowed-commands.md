# Allowed Commands - Safe Auto-Run List (V5.1)

Cac lenh sau duoc phep chay voi SafeToAutoRun: true.
Moi lenh KHONG co trong list -> PHAI hoi user truoc.

## 1. He thong va Dieu huong
ls, pwd, cat, tree, echo, find, which

## 2. Git (Chi DOC)
git status, git diff, git log, git branch

## 3. Node.js / Package Manager
npm install, npm i, npm ci, npm list
yarn install, pnpm install
npm run dev, npm run build, npm run lint, npm run format, npm test
npx prisma generate, npx prisma validate

## 4. Python
pip install, pip list, python3 --version, python3 -m venv, pytest

## 5. Docker va Infra (Chi DOC)
docker ps, docker logs, docker-compose ps
pm2 status, pm2 logs

## 6. Network va API Test
curl, ping

## 7. Da ngon ngu
go run, go build, go test, go mod tidy
cargo check, cargo test
composer install, php -v

## BLACKLIST - KHONG BAO GIO auto-run
- prisma db push, drizzle-kit push, migrate
- rm -rf, sudo rm
- docker rm, docker stop, docker-compose down
- git push, git merge, git rebase
- DROP, TRUNCATE, DELETE FROM (SQL)
- shutdown, reboot
