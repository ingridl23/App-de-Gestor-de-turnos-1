import { router } from 'expo-router';

import ServiceForm, { type ServiceFormValues } from '@/components/ServiceForm';
import { useBusinessStore } from '@/store/businessStore';
import { useServiceStore } from '@/store/serviceStore';

export default function NewServiceScreen() {
  const { business } = useBusinessStore();
  const { createService } = useServiceStore();

  const handleSubmit = async (values: ServiceFormValues): Promise<string | null> => {
    if (!business) return 'No se encontró el negocio.';

    const err = await createService({
      business_id: business.id,
      ...values,
    });

    if (!err) router.back();
    return err;
  };

  return <ServiceForm onSubmit={handleSubmit} submitLabel="Crear servicio" />;
}
