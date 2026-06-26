import { TextInput, type TextInputProps } from 'react-native';

interface Props extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChange: (value: string) => void;
  isInvalid?: boolean;
}

/**
 * Input para hora en formato HH:mm.
 * Auto-inserta ":" después de los dos primeros dígitos.
 */
export default function TimeInput({ value, onChange, isInvalid, ...rest }: Props) {
  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length === 0) {
      onChange('');
    } else if (digits.length <= 2) {
      onChange(digits);
    } else {
      onChange(`${digits.slice(0, 2)}:${digits.slice(2, 4)}`);
    }
  };

  return (
    <TextInput
      value={value}
      onChangeText={handleChange}
      placeholder="09:00"
      placeholderTextColor="#9ca3af"
      keyboardType="numeric"
      maxLength={5}
      className={`w-16 text-center text-sm font-medium rounded-lg py-2 border ${
        isInvalid
          ? 'border-red-300 text-red-600 bg-red-50'
          : 'border-gray-200 text-gray-800 bg-white'
      }`}
      {...rest}
    />
  );
}
