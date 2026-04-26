# news.ts 라우터 연결

server/src/index.ts에 아래 두 줄 추가:

```ts
import newsRouter from './routes/news.js';
app.use('/api/insight', newsRouter);
```

마이그레이션:
```bash
cd server
mysql -u$DB_USER -p$DB_PASSWORD $DB_NAME < migrations/002_news.sql
```
