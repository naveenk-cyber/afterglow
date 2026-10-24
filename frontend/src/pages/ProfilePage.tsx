import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Bell,
  Car,
  CheckCircle2,
  CreditCard,
  Heart,
  LogOut,
  Mail,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  Zap,
} from 'lucide-react';
import PageHero from '../components/layout/PageHero';
import Breadcrumbs from '../components/ui/Breadcrumbs';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import ButtonLink from '../components/ui/ButtonLink';
import Checkbox from '../components/ui/Checkbox';
import EmptyState from '../components/ui/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { useFavorites } from '../hooks/useFavorites';
import { useRecentlyViewed } from '../hooks/useRecentlyViewed';
import { userService } from '../services/api';
import type { Vehicle } from '../types';
import { VALIDATION_RULES } from '../utils/constants';

const CONNECTORS = ['J1772', 'CCS', 'CHAdeMO', 'Tesla', 'Type 2'];

type TabId = 'profile' | 'vehicles' | 'preferences' | 'privacy';

const TABS: { id: TabId; label: string; icon: typeof UserIcon }[] = [
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'vehicles', label: 'Vehicles', icon: Car },
  { id: 'preferences', label: 'Preferences', icon: Bell },
  { id: 'privacy', label: 'Data & privacy', icon: ShieldCheck },
];

const inputClass =
  'h-11 w-full rounded-control border border-line bg-surface-muted px-3.5 text-sm text-ink ' +
  'placeholder:text-ink-subtle transition-colors hover:border-line-strong focus:border-brand ' +
  'focus:outline-none focus:ring-2 focus:ring-brand/25 disabled:cursor-not-allowed disabled:opacity-60';

const labelClass = 'mb-1.5 block text-sm font-medium text-ink';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser, refreshUser, logout } = useAuth();
  const {
    favorites: favouriteIds,
    stations: favouriteStations,
    isLoading: favouritesLoading,
    removeFavorite,
  } = useFavorites();
  const { ids: recentIds, clearRecent } = useRecentlyViewed();

  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [profileSaved, setProfileSaved] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);

  const [vehicleDraft, setVehicleDraft] = useState({
    make: '',
    model: '',
    year: String(new Date().getFullYear()),
    batteryCapacity: '75',
    estimatedRange: '300',
  });
  const [vehicleConnectors, setVehicleConnectors] = useState<string[]>(['CCS']);
  const [vehicleError, setVehicleError] = useState('');

  const [prefsSaved, setPrefsSaved] = useState('');
  const [historyMessage, setHistoryMessage] = useState('');

  const vehicles = useMemo(() => user?.vehicles ?? [], [user]);
  const preferences = user?.preferences ?? {
    units: 'imperial' as const,
    language: 'en',
    notifications: { email: true, push: false, sms: false },
  };

  if (!user) return null;

  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
  });

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (name.trim().length < VALIDATION_RULES.NAME_MIN_LENGTH) {
      errors.name = 'Add your full name before saving.';
    }
    if (phone.trim() && !VALIDATION_RULES.PHONE.test(phone.trim())) {
      errors.phone = 'Use digits, spaces and an optional leading +.';
    }
    setProfileErrors(errors);
    setProfileSaved('');
    if (Object.keys(errors).length > 0) return;

    setIsSavingProfile(true);
    try {
      await updateUser({ name: name.trim(), phone: phone.trim() });
      setProfileSaved('Profile updated.');
    } catch (error) {
      setProfileSaved(
        error instanceof Error ? error.message : 'Profile could not be saved. Try again.',
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const addVehicle = async (event: React.FormEvent) => {
    event.preventDefault();
    const year = Number(vehicleDraft.year);
    const batteryCapacity = Number(vehicleDraft.batteryCapacity);
    const estimatedRange = Number(vehicleDraft.estimatedRange);

    if (!vehicleDraft.make.trim() || !vehicleDraft.model.trim()) {
      setVehicleError('Add the vehicle make and model.');
      return;
    }
    if (!Number.isInteger(year) || year < 1990 || year > 2100) {
      setVehicleError('Enter a model year between 1990 and 2100.');
      return;
    }
    if (!Number.isFinite(batteryCapacity) || batteryCapacity <= 0 || batteryCapacity > 500) {
      setVehicleError('Battery capacity should be between 1 and 500 kWh.');
      return;
    }
    if (vehicleConnectors.length === 0) {
      setVehicleError('Pick at least one connector your car can use.');
      return;
    }

    setIsSavingVehicle(true);
    setVehicleError('');
    try {
      await userService.createVehicle({
        make: vehicleDraft.make.trim(),
        model: vehicleDraft.model.trim(),
        year,
        batteryCapacity,
        estimatedRange: Number.isFinite(estimatedRange) && estimatedRange > 0 ? estimatedRange : 0,
        connectorTypes: vehicleConnectors,
        isDefault: vehicles.length === 0,
      } as Omit<Vehicle, 'id'>);
      await refreshUser();
      setVehicleDraft({
        make: '',
        model: '',
        year: String(new Date().getFullYear()),
        batteryCapacity: '75',
        estimatedRange: '300',
      });
      setVehicleConnectors(['CCS']);
    } catch (error) {
      setVehicleError(
        error instanceof Error ? error.message : 'The vehicle could not be saved. Try again.',
      );
    } finally {
      setIsSavingVehicle(false);
    }
  };

  const removeVehicle = async (id: string) => {
    try {
      await userService.deleteVehicle(id);
      await refreshUser();
    } catch (error) {
      setVehicleError(
        error instanceof Error ? error.message : 'The vehicle could not be removed. Try again.',
      );
    }
  };

  const makeDefault = async (id: string) => {
    try {
      await userService.updateVehicle(id, { isDefault: true });
      await refreshUser();
    } catch (error) {
      setVehicleError(
        error instanceof Error ? error.message : 'The default vehicle could not be changed.',
      );
    }
  };

  const setPreference = async (patch: {
    units?: 'metric' | 'imperial';
    notifications?: Partial<{ email: boolean; push: boolean; sms: boolean }>;
  }) => {
    try {
      await updateUser({
        preferences: {
          ...preferences,
          ...patch,
          notifications: { ...preferences.notifications, ...(patch.notifications ?? {}) },
        },
      });
      setPrefsSaved('Preferences saved to your account.');
    } catch (error) {
      setPrefsSaved(
        error instanceof Error ? error.message : 'Preferences could not be saved. Try again.',
      );
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div>
      <PageHero
        eyebrow="Account"
        title="Your profile, vehicles and preferences"
        description="Profile, vehicles and preferences are stored with your Afterglow account. Passwords are hashed on the server and never returned to this page."
      />

      <div className="mx-auto max-w-[1280px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Profile' }]} />

        <section className="mt-6 flex flex-col gap-5 rounded-panel border border-line bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-brand/25 bg-brand-soft text-xl font-semibold text-brand-soft-ink">
              {initials || 'CE'}
            </span>
            <div className="min-w-0">
              <h2 className="ev-title text-ink">{user.name}</h2>
              <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-ink-muted">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {user.email}
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
                <span>Member since {memberSince}</span>
                <span className="h-1 w-1 rounded-full bg-line-strong" aria-hidden="true" />
                <span>{vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={user.membershipLevel === 'Free' ? 'neutral' : 'brand'}>
              {user.membershipLevel} plan
            </Badge>
            <ButtonLink to="/membership" variant="ghost" size="sm">
              Manage plan
            </ButtonLink>
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
          <nav
            aria-label="Profile sections"
            className="grid grid-cols-2 gap-1 rounded-card border border-line bg-surface p-1.5 sm:grid-cols-4 lg:grid-cols-1"
          >
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex shrink-0 items-center gap-2 rounded-control px-3 py-2 text-sm font-medium transition-colors lg:w-full ${
                    active
                      ? 'bg-brand-soft text-brand-soft-ink'
                      : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                  }`}
                >
                  <tab.icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="rounded-panel border border-line bg-surface p-5 shadow-card sm:p-6">
            {activeTab === 'profile' && (
              <form onSubmit={saveProfile} noValidate>
                <h2 className="ev-card-title text-ink">Personal information</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  The email address identifies your session and cannot be changed here.
                </p>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="profile-name" className={labelClass}>
                      Full name
                    </label>
                    <input
                      id="profile-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={inputClass}
                      autoComplete="name"
                      aria-invalid={Boolean(profileErrors.name)}
                    />
                    {profileErrors.name && (
                      <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-error-ink">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        {profileErrors.name}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="profile-phone" className={labelClass}>
                      Phone <span className="font-normal text-ink-subtle">(optional)</span>
                    </label>
                    <input
                      id="profile-phone"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className={inputClass}
                      autoComplete="tel"
                      placeholder="+1 512 555 0134"
                      aria-invalid={Boolean(profileErrors.phone)}
                    />
                    {profileErrors.phone && (
                      <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-error-ink">
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        {profileErrors.phone}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="profile-email" className={labelClass}>
                      Email
                    </label>
                    <input id="profile-email" value={user.email} disabled className={inputClass} />
                  </div>

                  <div>
                    <label htmlFor="profile-units" className={labelClass}>
                      Distance units
                    </label>
                    <select
                      id="profile-units"
                      value={preferences.units}
                      onChange={(event) =>
                        setPreference({ units: event.target.value as 'metric' | 'imperial' })
                      }
                      className={inputClass}
                    >
                      <option value="imperial">Miles</option>
                      <option value="metric">Kilometres</option>
                    </select>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    isLoading={isSavingProfile}
                    leftIcon={<Save className="h-4 w-4" />}
                  >
                    Save changes
                  </Button>
                  <span className="text-xs text-ink-subtle">Saved to your account.</span>
                </div>

                {profileSaved && (
                  <p role="status" className="mt-4 flex items-center gap-2 text-xs text-success-ink">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {profileSaved}
                  </p>
                )}
              </form>
            )}

            {activeTab === 'vehicles' && (
              <div>
                <h2 className="ev-card-title text-ink">Your vehicles</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  Vehicle details are used to explain connector compatibility. They are stored with
                  this session, not sent to an operator.
                </p>

                {vehicles.length === 0 ? (
                  <EmptyState
                    icon={Car}
                    title="No vehicle added yet"
                    description="Add the car you drive so the connector guide can be read against your own port."
                    className="mt-5"
                  />
                ) : (
                  <ul className="mt-5 space-y-3">
                    {vehicles.map((vehicle) => (
                      <li
                        key={vehicle.id}
                        className="flex flex-col gap-3 rounded-card border border-line bg-surface-muted p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                            {vehicle.make} {vehicle.model}
                            <span className="font-normal text-ink-subtle">{vehicle.year}</span>
                            {vehicle.isDefault && <Badge tone="brand">Default</Badge>}
                          </p>
                          <p className="mt-1 text-xs text-ink-muted">
                            {vehicle.batteryCapacity} kWh battery
                            {vehicle.estimatedRange > 0 && ` · ${vehicle.estimatedRange} mi range`}
                            {vehicle.connectorTypes.length > 0 &&
                              ` · ${vehicle.connectorTypes.join(', ')}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {!vehicle.isDefault && (
                            <Button variant="ghost" size="sm" onClick={() => void makeDefault(vehicle.id)}>
                              Make default
                            </Button>
                          )}
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void removeVehicle(vehicle.id)}
                            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                          >
                            Remove
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <form onSubmit={addVehicle} className="mt-6 border-t border-line pt-5">
                  <h3 className="ev-card-title text-ink">Add a vehicle</h3>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="vehicle-make" className={labelClass}>
                        Make
                      </label>
                      <input
                        id="vehicle-make"
                        value={vehicleDraft.make}
                        onChange={(event) =>
                          setVehicleDraft({ ...vehicleDraft, make: event.target.value })
                        }
                        className={inputClass}
                        placeholder="Hyundai"
                      />
                    </div>
                    <div>
                      <label htmlFor="vehicle-model" className={labelClass}>
                        Model
                      </label>
                      <input
                        id="vehicle-model"
                        value={vehicleDraft.model}
                        onChange={(event) =>
                          setVehicleDraft({ ...vehicleDraft, model: event.target.value })
                        }
                        className={inputClass}
                        placeholder="Ioniq 5"
                      />
                    </div>
                    <div>
                      <label htmlFor="vehicle-year" className={labelClass}>
                        Year
                      </label>
                      <input
                        id="vehicle-year"
                        inputMode="numeric"
                        value={vehicleDraft.year}
                        onChange={(event) =>
                          setVehicleDraft({ ...vehicleDraft, year: event.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="vehicle-battery" className={labelClass}>
                        Battery capacity (kWh)
                      </label>
                      <input
                        id="vehicle-battery"
                        inputMode="decimal"
                        value={vehicleDraft.batteryCapacity}
                        onChange={(event) =>
                          setVehicleDraft({ ...vehicleDraft, batteryCapacity: event.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="vehicle-range" className={labelClass}>
                        Estimated range (mi)
                      </label>
                      <input
                        id="vehicle-range"
                        inputMode="decimal"
                        value={vehicleDraft.estimatedRange}
                        onChange={(event) =>
                          setVehicleDraft({ ...vehicleDraft, estimatedRange: event.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <fieldset className="mt-4">
                    <legend className="mb-2 text-sm font-medium text-ink">Connector types</legend>
                    <div className="flex flex-wrap gap-2">
                      {CONNECTORS.map((connector) => {
                        const active = vehicleConnectors.includes(connector);
                        return (
                          <button
                            key={connector}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setVehicleConnectors((current) =>
                                current.includes(connector)
                                  ? current.filter((item) => item !== connector)
                                  : [...current, connector],
                              )
                            }
                            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                              active
                                ? 'border-brand bg-brand-soft text-brand-soft-ink'
                                : 'border-line text-ink-muted hover:border-line-strong hover:text-ink'
                            }`}
                          >
                            {connector}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {vehicleError && (
                    <p role="alert" className="mt-3 flex items-center gap-1.5 text-xs text-error-ink">
                      <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      {vehicleError}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="mt-4"
                    isLoading={isSavingVehicle}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Add vehicle
                  </Button>
                </form>
              </div>
            )}

            {activeTab === 'preferences' && (
              <div>
                <h2 className="ev-card-title text-ink">Notifications</h2>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                  Delivery providers are not connected in this build. The switches are saved to
                  your account so the preference is kept, but no messages are sent.
                </p>

                <div className="mt-5 divide-y divide-line rounded-card border border-line">
                  {[
                    {
                      key: 'email' as const,
                      label: 'Email updates',
                      hint: 'Booking confirmations and account notices.',
                    },
                    {
                      key: 'push' as const,
                      label: 'Push alerts',
                      hint: 'Reminders before a planned charging session.',
                    },
                    {
                      key: 'sms' as const,
                      label: 'SMS alerts',
                      hint: 'Only for time-sensitive changes. Never used for marketing.',
                    },
                  ].map((item) => (
                    <div key={item.key} className="flex items-start justify-between gap-4 p-4">
                      <div>
                        <p className="text-sm font-medium text-ink">{item.label}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{item.hint}</p>
                      </div>
                      <Checkbox
                        checked={preferences.notifications[item.key]}
                        onChange={(checked) => setPreference({ notifications: { [item.key]: checked } })}
                      >
                        <span className="sr-only">{item.label}</span>
                      </Checkbox>
                    </div>
                  ))}
                </div>

                {prefsSaved && (
                  <p role="status" className="mt-4 flex items-center gap-2 text-xs text-success-ink">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {prefsSaved}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'privacy' && (
              <div>
                <h2 className="ev-card-title text-ink">What is stored, and where</h2>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-ink-muted">
                  <li className="flex gap-2.5">
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                    Your account record stores your name, email, phone, hashed password and
                    preferences. The browser only holds the HttpOnly session cookie set by the API.
                  </li>
                  <li className="flex gap-2.5">
                    <Heart className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                    You have {favouriteIds.length} saved station
                    {favouriteIds.length === 1 ? '' : 's'} and {recentIds.length} recently viewed
                    station{recentIds.length === 1 ? '' : 's'} on this device.
                  </li>
                  <li className="flex gap-2.5">
                    <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                    No card details are collected. The wallet is a simulated ledger — see the wallet
                    page for its transactions.
                  </li>
                </ul>

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Button
                    variant="ghost"
                    size="md"
                    onClick={() => {
                      clearRecent();
                      setHistoryMessage('Recently viewed stations cleared on this device.');
                    }}
                  >
                    Clear recently viewed
                  </Button>
                  <ButtonLink to="/wallet" variant="ghost" size="md">
                    Open wallet
                  </ButtonLink>
                  <Button
                    variant="destructive"
                    size="md"
                    onClick={handleSignOut}
                    leftIcon={<LogOut className="h-4 w-4" />}
                  >
                    Sign out
                  </Button>
                </div>
                {historyMessage && (
                  <p role="status" className="mt-3 text-xs text-success-ink">
                    {historyMessage}
                  </p>
                )}
                <p className="mt-5 rounded-control border border-line bg-surface-muted px-3 py-2.5 text-xs leading-relaxed text-ink-subtle">
                  Signing out revokes the server session and clears it from this browser. Saved
                  stations stay with your account.
                </p>
              </div>
            )}

            <section
              className="mt-6 border-t border-line pt-5"
              aria-labelledby="saved-stations-heading"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 id="saved-stations-heading" className="ev-card-title flex items-center gap-2 text-ink">
                    <Heart className="h-4 w-4 text-brand" aria-hidden="true" />
                    Saved stations
                  </h2>
                  <p className="mt-1 text-xs text-ink-subtle">
                    Stored with your account and available on every signed-in device.
                  </p>
                </div>
                <Badge tone="neutral">{favouriteStations.length}</Badge>
              </div>

              {favouritesLoading ? (
                <p className="mt-3 text-sm text-ink-muted">Loading saved stations…</p>
              ) : favouriteStations.length === 0 ? (
                <p className="mt-3 rounded-control border border-dashed border-line bg-surface-muted px-3 py-3 text-sm text-ink-muted">
                  Nothing saved yet. Use the heart on a station card or the station page.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-line rounded-card border border-line">
                  {favouriteStations.map((station) => (
                    <li
                      key={station.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <Link
                          to={`/station/${station.id}`}
                          className="block truncate text-sm font-medium text-ink underline-offset-2 hover:text-brand hover:underline"
                        >
                          {station.name}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-ink-subtle">
                          {station.city || station.address}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${station.name}`}
                        onClick={() => void removeFavorite(station.id)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
