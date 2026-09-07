import { Link } from 'react-router-dom';
import { Panel } from '../components/legacy/primitives.jsx';
import { StateBlock } from '../components/legacy/states.jsx';

export function NotFoundPage() {
  return (
    <div className="page page--narrow">
      <Panel>
        <StateBlock
          icon="search"
          title="Sayfa bulunamadı"
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
