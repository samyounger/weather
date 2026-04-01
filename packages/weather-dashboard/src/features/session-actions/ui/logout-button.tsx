import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../app/providers/auth-provider';

export const LogoutButton = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <button
      className="button-secondary"
      type="button"
      onClick={() => {
        signOut();
        navigate('/login');
      }}
    >
      Sign out
    </button>
  );
};
