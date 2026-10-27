import { Redirect, router } from 'expo-router';
import { useToast } from 'heroui-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextInput } from 'react-native';

import { FormField } from '@/components/ui/FormField';
import { FormScreen } from '@/components/ui/FormScreen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { haptics } from '@/lib/haptics';

type PersonType = 'individual' | 'company';

/**
 * Yalnızca __DEV__: FormScreen'in klavye davranışını (iPhone SE dahil) test etmek için örnek form.
 * Sürüm derlemesinde derin bağlantıyla açılırsa ana sayfaya döner.
 */
export default function FormDemoScreen() {
  return __DEV__ ? <FormDemo /> : <Redirect href="/" />;
}

function FormDemo() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [personType, setPersonType] = useState<PersonType>('individual');
  const [isSubmitting, setSubmitting] = useState(false);

  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const districtRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const taxRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);

  const submit = () => {
    if (isSubmitting) return;
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      haptics.success();
      toast.show({ variant: 'success', label: t('formDemo.saved') });
      router.back();
    }, 600);
  };

  return (
    <FormScreen onSubmit={submit} isSubmitting={isSubmitting}>
      <SegmentedControl<PersonType>
        value={personType}
        onChange={setPersonType}
        options={[
          { value: 'individual', label: t('personTypes.individual') },
          { value: 'company', label: t('personTypes.company') },
        ]}
      />
      <FormField
        label={t('formDemo.name')}
        isRequired
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => phoneRef.current?.focus()}
      />
      <FormField
        ref={phoneRef}
        label={t('formDemo.phone')}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <FormField
        ref={emailRef}
        label={t('formDemo.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => cityRef.current?.focus()}
      />
      <FormField
        ref={cityRef}
        label={t('formDemo.city')}
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => districtRef.current?.focus()}
      />
      <FormField
        ref={districtRef}
        label={t('formDemo.district')}
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => addressRef.current?.focus()}
      />
      <FormField
        ref={addressRef}
        label={t('formDemo.address')}
        autoComplete="street-address"
        textContentType="fullStreetAddress"
        multiline
        textAlignVertical="top"
      />
      <FormField
        ref={taxRef}
        label={t('formDemo.taxNumber')}
        keyboardType="number-pad"
        maxLength={11}
        returnKeyType="next"
        onSubmitEditing={() => noteRef.current?.focus()}
      />
      <FormField
        ref={noteRef}
        label={t('formDemo.note')}
        returnKeyType="done"
        onSubmitEditing={submit}
      />
    </FormScreen>
  );
}
