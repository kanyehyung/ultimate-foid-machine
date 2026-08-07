import { useEffect } from 'react';
import { View, Text } from 'react-native';
import { supabase } from './lib/supabaseClient';

export default function App() {
  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase.from('reminders').select('*');
      console.log('Reminders:', data, 'Error:', error);
    }
    testConnection();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Ultimate FOID Machine — check your console</Text>
    </View>
  );
}