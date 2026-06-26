import { router, useLocalSearchParams } from 'expo-router';

import ServiceForm, { type ServiceFormValues } from '@/components/ServiceForm';
import { useServiceStore } from '@/store/serviceStore';

export default function EditServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { services, updateService } = useServiceStore();

  const service = services.find((s) => s.id === id);

  if (!service) {
    router.back();
    return null;
  }

  const handleSubmit = async (values: ServiceFormValues): Promise<string | null> => {
    const err = await updateService(id, values);
    if (!err) router.back();
    return err;
  };

  return (
    <ServiceForm
      initialValues={{
        name: service.name,
        description: service.description ?? '',
        duration_minutes: service.duration_minutes,
        price: service.price,
      }}
      onSubmit={handleSubmit}
      submitLabel="Guardar cambios"
    />
  );
}
