import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface User {
  id: number;
  wallet_address: string;
  username: string | null;
  created_at: string;
}

export default function ProfilePage() {
  const params = useParams();
  const address = params.address as string;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/users/${address}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch user');
        return res.json();
      })
      .then(data => {
        setUser(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load user profile');
        setLoading(false);
      });
  }, [address]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Trader Profile</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Wallet Address</label>
          <p className="text-gray-900">{user.wallet_address}</p>
        </div>
        {user.username && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Username</label>
            <p className="text-gray-900">{user.username}</p>
          </div>
        )}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Joined</label>
          <p className="text-gray-900">{new Date(user.created_at).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
