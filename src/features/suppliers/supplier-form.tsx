"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/use-toast-store";
import {
  createSupplierAction,
  updateSupplierAction,
} from "@/features/suppliers/actions";
import { parseDecimal } from "@/lib/ingredients/formatters";
import type { SupplierWithRelations } from "@/lib/suppliers/types";
import type { PaymentMethodRow } from "@/services/suppliers-service";

interface SupplierFormProps {
  mode: "create" | "edit";
  supplier?: SupplierWithRelations | null;
  paymentMethods: PaymentMethodRow[];
}

interface ContactState {
  id?: string;
  first_name: string;
  last_name: string;
  job_title: string;
  email: string;
  phone: string;
  mobile: string;
  is_primary: boolean;
  is_active: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SupplierForm({
  mode,
  supplier,
  paymentMethods,
}: SupplierFormProps) {
  const t = useTranslations("supplierForm");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(supplier?.name ?? "");
  const [code, setCode] = useState(supplier?.code ?? "");
  const [legalName, setLegalName] = useState(supplier?.legal_name ?? "");
  const [registrationNumber, setRegistrationNumber] = useState(
    supplier?.registration_number ?? ""
  );
  const [taxIdentifier, setTaxIdentifier] = useState(
    supplier?.tax_identifier ?? ""
  );
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [mobile, setMobile] = useState(supplier?.mobile ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [website, setWebsite] = useState(supplier?.website ?? "");
  const [addressLine1, setAddressLine1] = useState(
    supplier?.address_line_1 ?? ""
  );
  const [addressLine2, setAddressLine2] = useState(
    supplier?.address_line_2 ?? ""
  );
  const [postalCode, setPostalCode] = useState(supplier?.postal_code ?? "");
  const [city, setCity] = useState(supplier?.city ?? "");
  const [state, setState] = useState(supplier?.state ?? "");
  const [country, setCountry] = useState(supplier?.country ?? "");
  const [contactPerson, setContactPerson] = useState(
    supplier?.contact_person ?? ""
  );
  const [contactEmail, setContactEmail] = useState(
    supplier?.contact_email ?? ""
  );
  const [contactPhone, setContactPhone] = useState(
    supplier?.contact_phone ?? ""
  );
  const [paymentTerms, setPaymentTerms] = useState(supplier?.payment_terms ?? "");
  const [defaultPaymentMethodId, setDefaultPaymentMethodId] = useState(
    supplier?.default_payment_method_id ?? ""
  );
  const [deliveryLeadTimeDays, setDeliveryLeadTimeDays] = useState(
    supplier?.delivery_lead_time_days != null
      ? String(supplier.delivery_lead_time_days)
      : ""
  );
  const [minimumOrderAmount, setMinimumOrderAmount] = useState(
    supplier?.minimum_order_amount != null
      ? String(supplier.minimum_order_amount)
      : ""
  );
  const [notes, setNotes] = useState(supplier?.notes ?? "");
  const [isActive, setIsActive] = useState(supplier?.is_active ?? true);
  const [contacts, setContacts] = useState<ContactState[]>(
    (supplier?.contacts ?? []).map((contact) => ({
      id: contact.id,
      first_name: contact.first_name ?? "",
      last_name: contact.last_name ?? "",
      job_title: contact.job_title ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      mobile: contact.mobile ?? "",
      is_primary: contact.is_primary,
      is_active: contact.is_active,
    }))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function updateContact(index: number, patch: Partial<ContactState>) {
    setContacts((prev) =>
      prev.map((contact, i) => (i === index ? { ...contact, ...patch } : contact))
    );
  }

  function removeContact(index: number) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  const clean = (value: string) => (value.trim() === "" ? null : value.trim());

  async function submit() {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = tc("common.required");
    if (email.trim() && !EMAIL_RE.test(email.trim()))
      errs.email = tRoot("supplierValidation.emailInvalid");
    if (contactEmail.trim() && !EMAIL_RE.test(contactEmail.trim()))
      errs.contactEmail = tRoot("supplierValidation.contactEmailInvalid");
    for (let i = 0; i < contacts.length; i += 1) {
      if (contacts[i].email.trim() && !EMAIL_RE.test(contacts[i].email.trim())) {
        errs[`contact-${i}-email`] = tRoot("supplierValidation.contactEmailInvalid");
      }
    }
    const leadTime = parseDecimal(deliveryLeadTimeDays);
    if (leadTime !== null && leadTime < 0)
      errs.deliveryLeadTimeDays = tRoot("supplierValidation.leadTimePositive");
    const minOrder = parseDecimal(minimumOrderAmount);
    if (minOrder !== null && minOrder < 0)
      errs.minimumOrderAmount = tRoot("supplierValidation.minimumOrderPositive");
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const base = {
      name: name.trim(),
      code: clean(code),
      legalName: clean(legalName),
      registrationNumber: clean(registrationNumber),
      taxIdentifier: clean(taxIdentifier),
      phone: clean(phone),
      mobile: clean(mobile),
      email: clean(email),
      website: clean(website),
      addressLine1: clean(addressLine1),
      addressLine2: clean(addressLine2),
      postalCode: clean(postalCode),
      city: clean(city),
      state: clean(state),
      country: clean(country),
      contactPerson: clean(contactPerson),
      contactEmail: clean(contactEmail),
      contactPhone: clean(contactPhone),
      paymentTerms: clean(paymentTerms),
      defaultPaymentMethodId: defaultPaymentMethodId
        ? defaultPaymentMethodId
        : null,
      deliveryLeadTimeDays: leadTime,
      minimumOrderAmount: minOrder,
      notes: clean(notes),
      isActive,
      contacts: contacts
        .filter((contact) => contact.first_name.trim() || contact.last_name.trim())
        .map((contact) => ({
          id: contact.id,
          first_name: clean(contact.first_name),
          last_name: clean(contact.last_name),
          job_title: clean(contact.job_title),
          email: clean(contact.email),
          phone: clean(contact.phone),
          mobile: clean(contact.mobile),
          is_primary: contact.is_primary,
          is_active: contact.is_active,
        })),
    };

    setBusy(true);
    const result =
      mode === "create"
        ? await createSupplierAction(base)
        : supplier
          ? await updateSupplierAction({ ...base, supplierId: supplier.id })
          : null;
    if (!result) return;
    setBusy(false);

    if (result.ok) {
      toast.success({
        title: mode === "create" ? t("created") : t("saved"),
      });
      if (result.ok && "id" in result && mode === "create") {
        router.push(`/suppliers/${(result as { data: { id: string } }).data.id}`);
      } else {
        router.push(supplier ? `/suppliers/${supplier.id}` : "/suppliers");
      }
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={mode === "create" ? t("titleCreate") : t("titleEdit")}
        breadcrumbs={[
          { label: tn("suppliers"), href: "/suppliers" },
          {
            label:
              mode === "create" ? t("breadcrumbCreate") : t("breadcrumbEdit"),
          },
        ]}
        actions={
          <Button variant="outline" onClick={() => router.push("/suppliers")}>
            {tc("common.cancel")}
          </Button>
        }
      />

      <div className="max-w-3xl space-y-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm">
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">{t("sections.general")}</legend>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label={t("fields.name")}
              htmlFor="supplier-name"
              required
              error={errors.name}
            >
              <Input
                id="supplier-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("fields.namePlaceholder")}
              />
            </Field>
            {mode === "edit" && (
              <Field label={t("fields.code")} htmlFor="supplier-code">
                <Input
                  id="supplier-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
            )}
            <Field label={t("fields.legalName")} htmlFor="supplier-legal-name">
              <Input
                id="supplier-legal-name"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
              />
            </Field>
            <Field
              label={t("fields.registrationNumber")}
              htmlFor="supplier-registration"
            >
              <Input
                id="supplier-registration"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
              />
            </Field>
            <Field label={t("fields.taxIdentifier")} htmlFor="supplier-tax">
              <Input
                id="supplier-tax"
                value={taxIdentifier}
                onChange={(e) => setTaxIdentifier(e.target.value)}
              />
            </Field>
            {mode === "create" && (
              <Field
                label={t("fields.code")}
                htmlFor="supplier-code"
                helpText={t("fields.codeHint")}
              >
                <Input
                  id="supplier-code"
                  value={code}
                  placeholder="SUP-0001"
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">{t("sections.contact")}</legend>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label={t("fields.phone")} htmlFor="supplier-phone">
              <Input
                id="supplier-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Field label={t("fields.mobile")} htmlFor="supplier-mobile">
              <Input
                id="supplier-mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </Field>
            <Field label={t("fields.email")} htmlFor="supplier-email" error={errors.email}>
              <Input
                id="supplier-email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label={t("fields.website")} htmlFor="supplier-website">
              <Input
                id="supplier-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </Field>
            <Field label={t("fields.contactPerson")} htmlFor="supplier-contact-person">
              <Input
                id="supplier-contact-person"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
              />
            </Field>
            <Field
              label={t("fields.contactEmail")}
              htmlFor="supplier-contact-email"
              error={errors.contactEmail}
            >
              <Input
                id="supplier-contact-email"
                type="email"
                inputMode="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </Field>
            <Field label={t("fields.contactPhone")} htmlFor="supplier-contact-phone">
              <Input
                id="supplier-contact-phone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">{t("sections.address")}</legend>
          <Field label={t("fields.addressLine1")} htmlFor="supplier-address-1">
            <Input
              id="supplier-address-1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
            />
          </Field>
          <Field label={t("fields.addressLine2")} htmlFor="supplier-address-2">
            <Input
              id="supplier-address-2"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label={t("fields.postalCode")} htmlFor="supplier-postal">
              <Input
                id="supplier-postal"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
              />
            </Field>
            <Field label={t("fields.city")} htmlFor="supplier-city">
              <Input
                id="supplier-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </Field>
            <Field label={t("fields.state")} htmlFor="supplier-state">
              <Input
                id="supplier-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
              />
            </Field>
            <Field label={t("fields.country")} htmlFor="supplier-country">
              <Input
                id="supplier-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              />
            </Field>
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold">{t("sections.commercial")}</legend>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label={t("fields.paymentTerms")} htmlFor="supplier-payment-terms">
              <Input
                id="supplier-payment-terms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder={t("fields.paymentTermsPlaceholder")}
              />
            </Field>
            <Field
              label={t("fields.defaultPaymentMethod")}
              htmlFor="supplier-payment-method"
            >
              <Select
                id="supplier-payment-method"
                value={defaultPaymentMethodId}
                onChange={(e) => setDefaultPaymentMethodId(e.target.value)}
              >
                <option value="">{t("noPaymentMethod")}</option>
                {paymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={t("fields.deliveryLeadTimeDays")}
              htmlFor="supplier-lead-time"
              error={errors.deliveryLeadTimeDays}
            >
              <Input
                id="supplier-lead-time"
                inputMode="numeric"
                value={deliveryLeadTimeDays}
                onChange={(e) => setDeliveryLeadTimeDays(e.target.value)}
              />
            </Field>
            <Field
              label={t("fields.minimumOrderAmount")}
              htmlFor="supplier-min-order"
              error={errors.minimumOrderAmount}
            >
              <Input
                id="supplier-min-order"
                inputMode="decimal"
                value={minimumOrderAmount}
                onChange={(e) => setMinimumOrderAmount(e.target.value)}
              />
            </Field>
          </div>
          <Field label={t("fields.notes")} htmlFor="supplier-notes">
            <Textarea
              id="supplier-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("fields.notesPlaceholder")}
            />
          </Field>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] p-3">
            <div>
              <p className="text-sm font-medium">{t("fields.isActive")}</p>
            </div>
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked)}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="flex w-full items-center justify-between text-sm font-semibold">
            {t("sections.contacts")}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setContacts((prev) => [
                  ...prev,
                  {
                    first_name: "",
                    last_name: "",
                    job_title: "",
                    email: "",
                    phone: "",
                    mobile: "",
                    is_primary: prev.length === 0,
                    is_active: true,
                  },
                ])
              }
            >
              <Plus className="size-4" aria-hidden /> {t("addContact")}
            </Button>
          </legend>
          {contacts.length === 0 && (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              —
            </p>
          )}
          {contacts.map((contact, index) => (
            <div
              key={contact.id ?? index}
              className="space-y-3 rounded-lg border border-[var(--color-border)] p-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label={t("fields.contactFirstName")}
                  htmlFor={`supplier-contact-${index}-first`}
                  error={errors[`contact-${index}-email`]}
                >
                  <Input
                    id={`supplier-contact-${index}-first`}
                    value={contact.first_name}
                    onChange={(e) =>
                      updateContact(index, { first_name: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label={t("fields.contactLastName")}
                  htmlFor={`supplier-contact-${index}-last`}
                >
                  <Input
                    id={`supplier-contact-${index}-last`}
                    value={contact.last_name}
                    onChange={(e) =>
                      updateContact(index, { last_name: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label={t("fields.contactJobTitle")}
                  htmlFor={`supplier-contact-${index}-job`}
                >
                  <Input
                    id={`supplier-contact-${index}-job`}
                    value={contact.job_title}
                    onChange={(e) =>
                      updateContact(index, { job_title: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label={t("fields.contactEmailShort")}
                  htmlFor={`supplier-contact-${index}-email`}
                >
                  <Input
                    id={`supplier-contact-${index}-email`}
                    type="email"
                    inputMode="email"
                    value={contact.email}
                    onChange={(e) =>
                      updateContact(index, { email: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label={t("fields.contactPhoneShort")}
                  htmlFor={`supplier-contact-${index}-phone`}
                >
                  <Input
                    id={`supplier-contact-${index}-phone`}
                    value={contact.phone}
                    onChange={(e) =>
                      updateContact(index, { phone: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label={t("fields.contactMobile")}
                  htmlFor={`supplier-contact-${index}-mobile`}
                >
                  <Input
                    id={`supplier-contact-${index}-mobile`}
                    value={contact.mobile}
                    onChange={(e) =>
                      updateContact(index, { mobile: e.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="flex items-center justify-between gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
                  <input
                    type="checkbox"
                    checked={contact.is_primary}
                    onChange={(e) =>
                      setContacts((prev) =>
                        prev.map((c, i) => ({
                          ...c,
                          is_primary: i === index ? e.target.checked : false,
                        }))
                      )
                    }
                    className="size-4 accent-[var(--color-primary)]"
                  />
                  {t("fields.contactIsPrimary")}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeContact(index)}
                  aria-label={t("fields.contactFirstName")}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </div>
          ))}
        </fieldset>
      </div>

      <div className="flex justify-end gap-2">
        <Link href="/suppliers">
          <Button variant="outline">{tc("common.cancel")}</Button>
        </Link>
        <Button onClick={submit} loading={busy}>
          {t("save")}
        </Button>
      </div>
    </div>
  );
}