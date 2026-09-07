import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { StateBlock } from '@/components/ui/states.jsx';

export function NotFoundPage() {
  return (
    <StateBlock
      title="Sayfa bulunamadı"
      action={
        <Button size="sm" variant="secondary" asChild>
          <Link to="/">Genel bakışa dön</Link>
        </Button>
      }
    />
  );
}

export default NotFoundPage;
