'use client';
import { useParams } from 'next/navigation';
import ProductFormPage from '../ProductForm';

export default function EditProduct() {
  const { id } = useParams<{ id: string }>();
  return <ProductFormPage mode="edit" productId={id} />;
}
