import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { useUserPreferences } from './useUserPreferences';

function PreferenceProbe({ label }) {
  const { preferences, setPreference } = useUserPreferences();
  return (
    <button type="button" onClick={() => setPreference('showTelemetry', !preferences.showTelemetry)}>
      {label}: {preferences.showTelemetry ? 'on' : 'off'}
    </button>
  );
}

describe('useUserPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('updates every mounted consumer immediately and persists the shared value', async () => {
    const user = userEvent.setup();
    render(
      <>
        <PreferenceProbe label="first" />
        <PreferenceProbe label="second" />
      </>,
    );

    expect(screen.getByRole('button', { name: 'first: off' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'second: off' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'first: off' }));

    expect(screen.getByRole('button', { name: 'first: on' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'second: on' })).toBeInTheDocument();
    expect(window.localStorage.getItem('xenovoya:user-preferences')).toContain('"showTelemetry":true');
  });
});
