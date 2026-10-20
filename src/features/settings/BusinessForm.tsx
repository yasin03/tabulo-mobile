import { Image } from 'expo-image';
import { useToast } from 'heroui-native';
import { ImagePlus, Trash2 } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Pressable, View, type TextInput } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { FormField } from '@/components/ui/FormField';
import { FormScreen } from '@/components/ui/FormScreen';
import { FormSection } from '@/components/ui/FormSection';
import { PickerField, textOptions } from '@/components/ui/PickerField';
import {
  createBusinessFormSchema,
  type BusinessFormOutput,
  type BusinessFormValues,
} from '@/core/forms/business';
import { districtsOf, PROVINCES } from '@/core/turkeyRegions';
import { callingCode } from '@/core/validation';
import { businessProfileRepo } from '@/db';
import { useMoney } from '@/lib/business';
import { errorMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useColors } from '@/lib/theme';
import { useConfirmDiscard } from '@/lib/useConfirmDiscard';
import { zodResolver } from '@/lib/zodResolver';
import {
  deleteStoredAttachment,
  pickLogo,
  resolveAttachmentUri,
  storeLogo,
  type PendingAttachment,
} from '@/platform/attachments';

const PROVINCE_OPTIONS = textOptions(PROVINCES.map((p) => p.name));

type BusinessFormProps = {
  initialValues: BusinessFormValues;
  logoUri: string | null;
};

/** İşletme profili (7.11): PDF ekstre başlığında kullanılır. Tüm alanlar isteğe bağlıdır. */
export function BusinessForm({ initialValues, logoUri }: BusinessFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const colors = useColors();
  const { language, phoneCountry } = useMoney();
  const turkishRules = language === 'tr';

  const schema = useMemo(
    () => createBusinessFormSchema({ phoneCountry, turkishRules }),
    [phoneCountry, turkishRules],
  );
  const {
    control,
    handleSubmit,
    setValue,
    formState: { isDirty, isSubmitting },
  } = useForm<BusinessFormValues, unknown, BusinessFormOutput>({
    defaultValues: initialValues,
    resolver: zodResolver(schema),
    shouldFocusError: true,
  });

  // Logo: `undefined` = değişmedi, `null` = kaldırıldı, değer = yeni seçilen.
  const [newLogo, setNewLogo] = useState<PendingAttachment | null | undefined>(undefined);
  const leave = useConfirmDiscard(isDirty || newLogo !== undefined);
  const city = useWatch({ control, name: 'city' });

  const phoneRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const taxNumberRef = useRef<TextInput>(null);
  const taxOfficeRef = useRef<TextInput>(null);
  const addressRef = useRef<TextInput>(null);

  const logoPreview =
    newLogo === undefined
      ? logoUri
        ? resolveAttachmentUri(logoUri)
        : null
      : (newLogo?.uri ?? null);

  const chooseLogo = async () => {
    try {
      const picked = await pickLogo();
      if (picked) setNewLogo(picked);
    } catch {
      haptics.error();
      toast.show({ variant: 'danger', label: t('attachments.pickFailed') });
    }
  };

  const save = async (output: BusinessFormOutput) => {
    let storedLogo: string | null | undefined;
    try {
      storedLogo = newLogo ? await storeLogo(newLogo) : newLogo;
      await businessProfileRepo.update({
        ...output,
        ...(storedLogo !== undefined ? { logoUri: storedLogo } : {}),
      });
    } catch (error) {
      if (storedLogo) deleteStoredAttachment(storedLogo);
      haptics.error();
      toast.show({ variant: 'danger', label: errorMessage(t, error) });
      return;
    }
    // Eski logo dosyası artık kullanılmıyor.
    if (storedLogo !== undefined && logoUri) deleteStoredAttachment(logoUri);
    haptics.success();
    toast.show({ variant: 'success', label: t('businessForm.saved') });
    leave();
  };

  const submit = handleSubmit(save, () => haptics.error());
  const errorText = (message?: string) => (message ? t(message as never) : undefined);

  return (
    <FormScreen onSubmit={submit} isSubmitting={isSubmitting}>
      <AppText className="text-[13px] leading-[19px] text-muted">{t('businessForm.hint')}</AppText>

      <View className="flex-row items-center gap-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(logoPreview ? 'businessForm.changeLogo' : 'businessForm.addLogo')}
          onPress={() => void chooseLogo()}
          className="h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface active:opacity-70"
        >
          {logoPreview ? (
            <Image
              source={{ uri: logoPreview }}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <ImagePlus size={26} color={colors.primary} />
          )}
        </Pressable>
        <View className="flex-1 gap-1">
          <AppText weight="bold">{t('businessForm.logo')}</AppText>
          <AppText className="text-[13px] leading-[18px] text-muted">
            {t('businessForm.logoHint')}
          </AppText>
          {logoPreview ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setNewLogo(null)}
              className="min-h-11 flex-row items-center gap-1.5 self-start active:opacity-70"
            >
              <Trash2 size={16} color={colors.negative} />
              <AppText weight="bold" className="text-negative">
                {t('businessForm.removeLogo')}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FormField
            ref={field.ref}
            label={t('businessForm.name')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={errorText(fieldState.error?.message)}
            autoCapitalize="words"
            autoComplete="organization"
            textContentType="organizationName"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => phoneRef.current?.focus()}
          />
        )}
      />

      <FormSection title={t('contactForm.contactSection')}>
        <Controller
          control={control}
          name="phone"
          render={({ field, fieldState }) => (
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
              placeholder={callingCode(phoneCountry)}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
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
              onSubmitEditing={() => taxNumberRef.current?.focus()}
            />
          )}
        />
      </FormSection>

      <FormSection title={t('businessForm.taxSection')}>
        <Controller
          control={control}
          name="taxNumber"
          render={({ field, fieldState }) => (
            <FormField
              ref={(node) => {
                field.ref(node);
                taxNumberRef.current = node;
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
              onSubmitEditing={() => (turkishRules ? taxOfficeRef : addressRef).current?.focus()}
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
                onSubmitEditing={() => addressRef.current?.focus()}
              />
            )}
          />
        ) : null}
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
                  label={t('contactForm.cityIntl')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  autoCapitalize="words"
                  textContentType="addressCity"
                />
              )}
            />
            <Controller
              control={control}
              name="district"
              render={({ field }) => (
                <FormField
                  label={t('contactForm.districtIntl')}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  autoCapitalize="words"
                  textContentType="addressState"
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
    </FormScreen>
  );
}
