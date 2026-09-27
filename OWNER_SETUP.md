# オーナー返信機能の設定

サイト訪問者にはログインを求めません。ブラウザに保存される識別用 Cookie で会話を復元します。同じ人でも別ブラウザや Cookie を消した後は別の会話になります。

1. Vercel プロジェクト `taisei-matching` に Supabase のデータベースを接続し、Supabase の SQL Editor で `database/schema.sql` を実行します。
2. Supabase Authentication のメールテンプレートを確認し、確認メールの本文に `{{ .Token }}` を含めます。リンク形式のままだと、オーナー画面で入力する確認コードが送られません。
3. Vercel の環境変数（Production）に以下を設定します。**値を GitHub に書かないでください。**

   - `SUPABASE_URL`: Supabase の Project URL
   - `SUPABASE_ANON_KEY`: publishable/anon key
   - `SUPABASE_SERVICE_ROLE_KEY`: サーバー専用の service role key
   - `VISITOR_SECRET`: 32バイト以上のランダムな秘密文字列
   - `OWNER_EMAIL`: オーナーが確認コードを受け取るメールアドレス

4. Vercel を再デプロイします。`https://taisei-matching.vercel.app/owner.html` でオーナーだけがメールの確認コードでログインできます。訪問者は通常のチャットで送信し、返信を待ちます。

データベースや上記環境変数を設定するまでは `/api/messages` が 503 を返し、メッセージは送信されません。公開前に実際の端末から送信、受信箱の閲覧、返信の受信を一通り確認してください。
