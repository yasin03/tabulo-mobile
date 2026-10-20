import { Description, Switch, useToast } from 'heroui-native';
import { useMemo, useRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { View, type TextInput } from 'react-native';

import { AmountInput } from '@/components/ui/AmountInput';
import { AppText } from '@/components/ui/AppText';
import { FormField } from '@/components/ui/FormField';
import { FormScreen } from '@/components/ui/FormScreen';
import { FormSection } from '@/components/ui/FormSection';
import { PickerField, textOptions } from '@/components/ui/PickerField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { toIsoDate } from '@/core/dates';
import {
  createContactFormSchema,
  EMPTY_CONTACT_FORM,
  type ContactFormOutput,
  type ContactFormValues,
} from '@/core/forms/contact';
import { districtsOf, PROVINCES } from '@/core/turkeyRegions';
import { callingCode } from '@/core/validation';
import { contactsRepo } from '@/db';
import { useMoney } from '@/lib/business';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { zodResolver } from '@/lib/zodResolver';

import { useContactLimit } from './useContactActions';

const PROVINCE_OPTIONS = textOptions(PROVINCES.map((p) => p.name));

type ContactFormProps =
  | { mode: 'new'; contactId?: undefined; initialValues?: undefined }
  | { mode: 'edit'; contactId: string; initialValues: ContactFormValues };

/** Cari ekle / düzenle (6.2). Klavye, yapışkan Kaydet ve kaydedilmemiş değişiklik onayı FormScreen + useConfirmDiscard'da. */
export function ContactForm({ mode, contactId, initialValues }: ContactFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { language, phoneCountry } = useMoney();
  const ensureCanActivate = useContactLimit();
  const isNew = mode === 'new';
  // TC / Vergi No doğrulaması, il-ilçe listesi ve etiketler yalnızca Türkiye ayarında (6.2).
  const turkishRules = language === 'tr';

  const schema = useMemo(
    () =>
      createContactFormSchema({ language, phoneCountry, turkishRules, isNew, today: toIsoDate() }),
    [language, phoneCountry, turkishRules, isNew],
  );

  const {
    control,
    handleSubmit,
    setValue,
    formState: { isDirty, isSubmitting },
  } = useForm<ContactFormValues, unknown, ContactFormOutput>({
    defaultValues: initialValues ?? EMPTY_CONTACT_FORM,
    resolver: zodResolver(schema),
    shouldFocusError: true,
  });
  // Kayıt başarısız olsa da RHF formu "gönderildi" sayar; koruma yalnızca başarılı kayıtta leave() ile kalkar.
  const leave = useConfirmDiscard(isDirty);

  const personType = useWatch({ control, name: 'personType' });
  const city = useWatch({ control, name: 'city' });
  const isIndividual = personType === 'individual';

  const idRef = useRef<TextInput>(null);
  const taxOfficeRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const districtRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);
  const noteRef = useRef<TextInput>(null);

  const save = async ({ contact, opening }: ContactFormOutput) => {
    const becomesActive =
      contact.status === 'active' && (isNew || initialValues?.status !== 'active');
    if (becomesActive && !(await ensureCanActivate())) return;
    try {
      if (isNew) await contactsRepo.create(contact, opening ?? undefined);
      else await contactsRepo.update(contactId, contact);
      haptics.success();
      toast.show({ variant: 'success', label: t('contacts.saved') });
      leave();
    } catch (error) {
      haptics.error();
      toast.show({ variant: 'danger', label: errorMessage(t, error) });
    }
  };

  const onInvalid = () => haptics.error();
  const submit = handleSubmit(save, onInvalid);
  const errorText = (message?: string) => (message ? t(message as never) : undefined);

  return (
    <FormScreen onSubmit={submit} isSubmitting={isSubmitting}>
      <Controller
        control={control}
        name="personType"
        render={({ field }) => (
          <SegmentedControl
            accessibilityLabel={t('contactForm.personType')}
            value={field.value}
            onChange={field.onChange}
            options={[
              { value: 'individual', label: t('personTypes.individual') },
              { value: 'company', label: t('personTypes.company') },
            ]}
          />
        )}
      />

      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FormField
            ref={field.ref}
            label={t(isIndividual ? 'contactForm.name' : 'contactForm.companyName')}
            isRequired
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errorText(fieldState.error?.message)}
            autoCapitalize="words"
            autoComplete={isIndividual ? 'name' : 'organization'}
            textContentType={isIndividual ? 'name' : 'organizationName'}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => idRef.current?.focus()}
          />
        )}
      />

      {isIndividual ? (
        <Controller
          control={control}
          name="nationalId"
          render={({ field, fieldState }) => (
            <FormField
              ref={(node) => {
                field.ref(node);
                idRef.current = node;
              }}
              label={t(turkishRules ? 'contactForm.nationalId' : 'contactForm.nationalIdIntl')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errorText(fieldState.error?.message)}
              keyboardType={turkishRules ? 'number-pad' : 'default'}
              autoCapitalize="characters"
              maxLength={turkishRules ? 11 : 30}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => phoneRef.current?.focus()}
            />
          )}
        />
      ) : (
        <>
          <Controller
            control={control}
            name="taxNumber"
            render={({ field, fieldState }) => (
              <FormField
                ref={(node) => {
                  field.ref(node);
                  idRef.current = node;
                }}
                label={t(turkishRules ? 'contactForm.taxNumber' : 'contactForm.taxNumberIntl')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errorText(fieldState.error?.message)}
                keyboardType={turkishRules ? 'number-pad' : 'default'}
                autoCapitalize="characters"
                maxLength={turkishRules ? 10 : 30}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => (turkishRules ? taxOfficeRef : phoneRef).current?.focus()}
              />
            )}
          />
          {turkishRules ? (
            <Controller
              control={control}
              name="taxOffice"
              render={({ field }) => (
                <FormField
                  ref={taxOfficeRef}
                  label={t('contactForm.taxOffice')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  autoCapitalize="words"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => phoneRef.current?.focus()}
                />
              )}
            />
          ) : null}
        </>
      )}

      <Controller
        control={control}
        name="role"
        render={({ field }) => (
          <View className="gap-1.5">
            <AppText weight="semibold" className="text-[14px]">
              {t('contactForm.role')}
            </AppText>
            <SegmentedControl
              accessibilityLabel={t('contactForm.role')}
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: 'customer', label: t('contactRoles.customer') },
                { value: 'supplier', label: t('contactRoles.supplier') },
                { value: 'both', label: t('contactRoles.both') },
              ]}
            />
          </View>
        )}
      />

      <FormSection title={t('contactForm.contactSection')}>
        <Controller
          control={control}
          name="phone"
          render={({ field, fieldState }) => (
            <View className="gap-1">
              <FormField
                ref={(node) => {
                  field.ref(node);
                  phoneRef.current = node;
                }}
                label={t('contactForm.phone')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errorText(fieldState.error?.message)}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
              {fieldState.error ? null : (
                <Description>
                  {t('contactForm.phoneHint', { code: callingCode(phoneCountry) })}
                </Description>
              )}
            </View>
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field, fieldState }) => (
            <FormField
              ref={(node) => {
                field.ref(node);
                emailRef.current = node;
              }}
              label={t('contactForm.email')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errorText(fieldState.error?.message)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => (turkishRules ? addressRef : cityRef).current?.focus()}
            />
          )}
        />
      </FormSection>

      <FormSection title={t('contactForm.addressSection')}>
        {turkishRules ? (
          <>
            <Controller
              control={control}
              name="city"
              render={({ field }) => (
                <PickerField
                  label={t('contactForm.city')}
                  placeholder={t('contactForm.selectCity')}
                  value={field.value}
                  options={PROVINCE_OPTIONS}
                  onChange={(next) => {
                    field.onChange(next);
                    // İl değişince eski ilçe yeni ilde yoksa temizlenir.
                    setValue('district', '', { shouldDirty: true });
                  }}
                />
              )}
            />
            <Controller
              control={control}
              name="district"
              render={({ field }) => (
                <PickerField
                  label={t('contactForm.district')}
                  placeholder={t('contactForm.selectDistrict')}
                  disabledPlaceholder={t('contactForm.selectCityFirst')}
                  value={field.value}
                  options={textOptions(districtsOf(city))}
                  onChange={field.onChange}
                />
              )}
            />
          </>
        ) : (
          <>
            <Controller
              control={control}
              name="city"
              render={({ field }) => (
                <FormField
                  ref={cityRef}
                  label={t('contactForm.cityIntl')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  autoCapitalize="words"
                  autoComplete="postal-address-locality"
                  textContentType="addressCity"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => districtRef.current?.focus()}
                />
              )}
            />
            <Controller
              control={control}
              name="district"
              render={({ field }) => (
                <FormField
                  ref={districtRef}
                  label={t('contactForm.districtIntl')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  autoCapitalize="words"
                  autoComplete="postal-address-region"
                  textContentType="addressState"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => addressRef.current?.focus()}
                />
              )}
            />
          </>
        )}
        <Controller
          control={control}
          name="address"
          render={({ field }) => (
            <FormField
              ref={addressRef}
              label={t('contactForm.address')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              autoComplete="street-address"
              textContentType="fullStreetAddress"
              multiline
              textAlignVertical="top"
            />
          )}
        />
      </FormSection>

      <Controller
        control={control}
        name="note"
        render={({ field }) => (
          <FormField
            ref={noteRef}
            label={t('contactForm.note')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            multiline
            textAlignVertical="top"
          />
        )}
      />

      {isNew ? (
        <FormSection title={t('contactForm.openingSection')} hint={t('contactForm.openingHint')}>
          <Controller
            control={control}
            name="openingAmount"
            render={({ field, fieldState }) => (
              <AmountInput
                ref={field.ref}
                label={t('contactForm.openingAmount')}
                value={field.value}
                onChangeText={field.onChange}
                onBlur={field.onBlur}
                error={errorText(fieldState.error?.message)}
                returnKeyType="done"
              />
            )}
          />
          <Controller
            control={control}
            name="openingDirection"
            render={({ field }) => (
              <SegmentedControl
                accessibilityLabel={t('contactForm.openingSection')}
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'receivable', label: t('contactForm.openingReceivable') },
                  { value: 'payable', label: t('contactForm.openingPayable') },
                ]}
              />
            )}
          />
        </FormSection>
      ) : null}

      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <View className="flex-row items-center gap-3 rounded-[18px] border border-border bg-surface px-4 py-3">
            <View className="flex-1 gap-0.5">
              <AppText weight="bold">{t('contactForm.active')}</AppText>
              <AppText className="text-[13px] leading-[18px] text-muted">
                {t('contactForm.activeHint')}
              </AppText>
            </View>
            <Switch
              accessibilityLabel={t('contactForm.active')}
              isSelected={field.value === 'active'}
              onSelectedChange={(selected) => field.onChange(selected ? 'active' : 'passive')}
            />
          </View>
        )}
      />
    </FormScreen>
  );
}
