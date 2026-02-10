export type RootStackParamList = {
  index: undefined;
  '(auth)/login': undefined;
  '(auth)/register': undefined;
  '(auth)/onboarding/patient-setup': undefined;
  '(auth)/onboarding/schedule-setup': undefined;
  '(caregiver)': undefined;
  '(caregiver)/index': undefined;
  '(caregiver)/photos/index': undefined;
  '(caregiver)/photos/[id]': { id: string };
  '(caregiver)/photos/pending': undefined;
  '(caregiver)/schedule': undefined;
  '(caregiver)/family': undefined;
  '(caregiver)/settings': undefined;
  '(supporter)': undefined;
  '(supporter)/index': undefined;
  '(supporter)/upload': undefined;
  'therapy/index': undefined;
  'therapy/session': undefined;
  'invite/[code]': { code: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
