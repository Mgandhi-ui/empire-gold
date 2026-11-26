import { redirect } from 'next/navigation';
import { currentUser, homeFor } from '@/lib/auth';
import { askCode, checkCode } from '../_act';
import { Flash, sp, type SP } from '../_ui';

export default async function Login({ searchParams }: { searchParams: SP }) {
  const u = await currentUser();
  if (u) redirect(homeFor(u.role));
  const sent = sp(searchParams, 'sent') === '1', email = sp(searchParams, 'email');
  return (
    <div className="login">
      <h1>Empire Gold</h1>
      <p className="sub">Back office, channel partners and buyers</p>
      <div className="steps"><span className={sent ? '' : 'on'}>1 · Email</span><span className={sent ? 'on' : ''}>2 · Code</span></div>
      <Flash s={searchParams} />
      {!sent ? (
        <form className="f" action={askCode}>
          <label>Your email<input name="email" type="email" autoComplete="email" required autoFocus defaultValue={email} /></label>
          <button type="submit">Send me a code</button>
          <p className="small muted">Only registered staff, approved brokers and buyers can sign in. Brokers can apply at empiregoldmazgaon.com/partners.</p>
        </form>
      ) : (
        <form className="f" action={checkCode}>
          <p className="small">If <b>{email}</b> has an account, a 6-digit code is on its way. It works for 10 minutes.</p>
          <input type="hidden" name="email" value={email} />
          <label>Code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus /></label>
          <button type="submit">Sign in</button>
          <a className="small" href="/login">Use a different email</a>
        </form>
      )}
    </div>
  );
}
