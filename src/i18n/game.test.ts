import { afterEach, describe, expect, it } from 'vitest';
import { useI18n } from './index';
import { gameText } from './game';

afterEach(() => {
  useI18n.setState({ locale: 'ru' });
});

describe('campaign localization', () => {
  it('uses Russian as the default campaign copy', () => {
    useI18n.setState({ locale: 'ru' });
    expect(gameText('Establish command')).toBe('Начать кампанию');
  });

  it('keeps English copy unchanged when English is selected', () => {
    useI18n.setState({ locale: 'en' });
    expect(gameText('Establish command')).toBe('Establish command');
  });

  it('keeps scenario and organization names unchanged', () => {
    useI18n.setState({ locale: 'ru' });
    expect(gameText('The Compute')).toBe('The Compute');
    expect(gameText('Meridian Group')).toBe('Meridian Group');
    expect(gameText('NodeWorks')).toBe('NodeWorks');
  });

  it('falls back to the source string for an untranslated runtime value', () => {
    useI18n.setState({ locale: 'ru' });
    expect(gameText('A future event not yet in the dictionary')).toBe('A future event not yet in the dictionary');
  });
});
