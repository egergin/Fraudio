import { Link } from 'react-router-dom';
import { Panel } from '../components/ui/primitives.jsx';
import { StateBlock } from '../components/ui/states.jsx';

export function NotFoundPage() {
  return (
    <div className="page page--narrow">
      <Panel>
        <StateBlock
          icon="search"
          title="Sayfa bulunamadı"
          message="Aradığınız sayfa mevcut değil veya taşınmış olabilir."
          action={
            <Link to="/" className="btn btn--primary btn--sm">
              Genel bakışa dön
            </Link>
          }
        />
      </Panel>
    </div>
  );
}

export default NotFoundPage;
