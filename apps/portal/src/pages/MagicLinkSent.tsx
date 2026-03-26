import { Link } from 'react-router-dom';

export default function MagicLinkSent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="bg-surface border border-border rounded-xl p-8 w-full max-w-sm text-center">
        <div className="text-4xl mb-4">{'\uD83D\uDCE7'}</div>
        <h2 className="text-lg font-bold text-gray-200 mb-2">Check your email</h2>
        <p className="text-gray-500 text-sm mb-6">
          We sent you a login link. Click it to access your project portal. The link expires in 15 minutes.
        </p>
        <Link to="/login" className="text-sm text-blue-400 hover:text-blue-300">
          Back to login
        </Link>
      </div>
    </div>
  );
}
