import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Bean,
  BookOpen,
  Boxes,
  ChevronRight,
  CircleHelp,
  Coffee,
  Factory,
  LayoutDashboard,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react';
import { Empty, ErrorNotice, Loading } from './components.js';
import { LotDetail, OrderDetails } from './Details.js';
import { usePage, useWorkspace } from './hooks.js';
import { OperationForm } from './OperationForm.js';
import { operations, type Operation } from './operations.js';
import { Directory } from './pages/Directory.js';
import { Inventory } from './pages/Inventory.js';
import { Orders } from './pages/Orders.js';
import { Overview } from './pages/Overview.js';
import { Production } from './pages/Production.js';
import { Purchasing } from './pages/Purchasing.js';
import type { Page } from './types.js';

const navigation = [
  {
    page: 'overview',
    label: 'Overview',
    icon: LayoutDashboard,
    subtitle: 'A little clarity for your daily grind.',
  },
  {
    page: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    subtitle: 'Know what you have, where it is, and where it came from.',
  },
  {
    page: 'purchasing',
    label: 'Purchasing',
    icon: Truck,
    subtitle: 'Keep the next delivery moving.',
  },
  {
    page: 'production',
    label: 'Production',
    icon: Factory,
    subtitle: 'From green beans to something worth brewing.',
  },
  {
    page: 'orders',
    label: 'Orders',
    icon: ShoppingBag,
    subtitle: 'Good coffee, on its way to your customers.',
  },
  {
    page: 'directory',
    label: 'Directory',
    icon: BookOpen,
    subtitle: 'Your products, people and places.',
  },
] as const;

export function App() {
  const { data, error, loading, reload } = useWorkspace();
  const [page, setPage] = usePage();
  const [search, setSearch] = useState('');
  const [operation, setOperation] = useState<Operation | null>(null);
  const [detail, setDetail] = useState<{ kind: 'lot' | 'order'; id: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 7000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const selected = navigation.find((n) => n.page === page)!;
  function navigate(next: Page) {
    setPage(next);
    setSearch('');
    setMenu(false);
  }
  function open(o: Operation) {
    setDetail(null);
    setOperation(o);
  }
  function saved(message: string) {
    setOperation(null);
    setNotice(message);
    void reload();
  }
  const createOrder = () => {
    if (data) open(operations(data).order);
  };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? 'menu-open' : ''}`}>
        <a className="brand" href="#/overview" onClick={() => navigate('overview')}>
          <span className="brand-mark">
            <Coffee size={24} strokeWidth={1.7} />
          </span>
          <span>
            coffee<span className="brand-second">management</span>
          </span>
        </a>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map(({ page: value, label, icon: Icon }) => (
            <button
              key={value}
              className={`nav-item ${page === value ? 'active' : ''}`}
              aria-current={page === value ? 'page' : undefined}
              onClick={() => navigate(value)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {page === value && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <Bean size={24} strokeWidth={1.3} />
          <h3>Every bean has a story.</h3>
          <p>Keep yours connected, from the first delivery to the last bag.</p>
          <button onClick={() => navigate('inventory')}>
            Explore your inventory <ArrowUpRight size={14} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span className="workspace-avatar">CM</span>
          <div>
            <strong>{data?.health.businessName ?? 'coffee-management'}</strong>
            <span>Operations workspace</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setMenu(!menu)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{selected.label}</strong>
          </div>
          <div className="topbar-tools">
            <div className="connection">
              <span className={error ? 'connection-dot offline' : 'connection-dot'} />
              {error ? 'Connection issue' : loading ? 'Syncing…' : 'Connected'}
            </div>
            <button
              className="icon-button"
              aria-label="Refresh workspace"
              disabled={loading}
              onClick={() => {
                void reload();
              }}
            >
              <RefreshCw size={17} className={loading ? 'spin' : ''} />
            </button>
            <button
              className="icon-button"
              aria-label="Workspace help"
              onClick={() => setHelp(!help)}
            >
              <CircleHelp size={19} />
            </button>
            <span className="user-avatar" title="Coffee operations">
              CM
            </span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <span className="eyebrow">COFFEE OPERATIONS</span>
              <h1>{selected.label}</h1>
              <p>{selected.subtitle}</p>
            </div>
            <button className="button primary" disabled={!data} onClick={createOrder}>
              <Plus size={17} /> New order
            </button>
          </div>
          {help && (
            <div className="help-panel">
              <strong>Your coffee operations, in one place</strong>
              <p>
                Start in Directory to add products, suppliers, customers and a warehouse. Create a
                purchase, receive its stock, then record production. Orders reserve packaged coffee
                until payment and shipment.
              </p>
              <p>
                Payments and cancellation refunds are simulations. Lot details show source history
                and stock movements.
              </p>
              <button className="text-button" onClick={() => setHelp(false)}>
                Got it
              </button>
            </div>
          )}
          {error && (
            <ErrorNotice
              message={`${data ? 'Could not refresh. Previously loaded records are shown. ' : ''}${error}`}
              retry={() => {
                void reload();
              }}
            />
          )}
          {notice && (
            <div className="success-notice" role="status">
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setNotice('')}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {page !== 'overview' && page !== 'production' && (
            <div className="search-row">
              <label className="search-box">
                <Search size={17} />
                <input
                  type="search"
                  aria-label={`Search ${selected.label.toLowerCase()}`}
                  placeholder={`Search ${selected.label.toLowerCase()}…`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <span className="muted">{data?.health.businessName}</span>
            </div>
          )}
          {!data ? (
            loading ? (
              <Loading />
            ) : (
              <Empty
                title="Workspace unavailable"
                text="Check that the API and database are running, then try again."
                action={
                  <button
                    className="button secondary"
                    onClick={() => {
                      void reload();
                    }}
                  >
                    Reconnect
                  </button>
                }
              />
            )
          ) : (
            <>
              {page === 'overview' && (
                <Overview
                  data={data}
                  navigate={navigate}
                  openOrder={(id) => setDetail({ kind: 'order', id })}
                />
              )}
              {page === 'inventory' && (
                <Inventory
                  data={data}
                  search={search}
                  openLot={(id) => setDetail({ kind: 'lot', id })}
                />
              )}
              {page === 'purchasing' && <Purchasing data={data} search={search} open={open} />}
              {page === 'production' && <Production data={data} open={open} />}
              {page === 'orders' && (
                <Orders
                  data={data}
                  search={search}
                  create={createOrder}
                  detail={(id) => setDetail({ kind: 'order', id })}
                />
              )}
              {page === 'directory' && <Directory data={data} search={search} open={open} />}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Coffee size={14} /> coffee-management
            </span>
            <span>From bean to bag, thoughtfully managed.</span>
          </footer>
        </main>
      </div>
      {operation && (
        <OperationForm operation={operation} close={() => setOperation(null)} saved={saved} />
      )}
      {data && detail?.kind === 'lot' && (
        <LotDetail id={detail.id} data={data} close={() => setDetail(null)} open={open} />
      )}
      {data && detail?.kind === 'order' && (
        <OrderDetails id={detail.id} data={data} close={() => setDetail(null)} open={open} />
      )}
    </div>
  );
}
