'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { DepartmentBlurb } from '@/components/departments/DepartmentBlurb';
import { eco } from '@/lib/eco';

type Post = {
  id: string;
  body: string;
  hashtags: string[];
  author: { name: string };
  _count: { likes: number; comments: number };
};

export default function CommunityPage() {
  const { isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    eco<Post[]>('/community/posts').then(setPosts).catch((err: Error) => setMessage(err.message));
  };
  useEffect(load, []);

  const publish = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await eco('/community/posts', { method: 'POST', body: JSON.stringify({ body }) });
      setBody('');
      load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'خطا');
    }
  };

  const like = async (id: string) => {
    await eco(`/community/posts/${id}/like`, { method: 'POST' });
    load();
  };

  return (
    <div className="page-content community-page">
      <div className="container hub">
        <header className="page-head">
          <h1>جامعه کیادات</h1>
          <DepartmentBlurb department="community" fallback="نوشته‌ها، پسندیدن و گفتگو." />
        </header>
        {message ? <p role="alert">{message}</p> : null}
        {isAuthenticated ? (
          <form onSubmit={publish} className="stack">
            <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="چه خبر؟" required />
            <button className="btn btn--primary" type="submit">انتشار</button>
          </form>
        ) : (
          <Link href="/education?next=/community" className="btn btn--primary">برای نوشتن وارد شوید</Link>
        )}
        <div className="bento">
          {posts.map((post) => (
            <article key={post.id} className="tile tile--half dept--community">
              <b>{post.author?.name || 'کاربر'}</b>
              <span>{post.body}</span>
              <span className="t-status">{post._count?.likes ?? 0} پسند · {post._count?.comments ?? 0} نظر</span>
              {isAuthenticated ? (
                <button type="button" className="btn btn--ghost" onClick={() => like(post.id)}>پسندیدن</button>
              ) : null}
            </article>
          ))}
        </div>
        <Link href="/community/panel">پنل جامعه</Link>
      </div>
    </div>
  );
}
