import { useCopy } from '../../hooks/useCopy'
import LegalDoc from './LegalDoc'

export default function Terms() {
  const { t } = useCopy()
  return <LegalDoc doc={t.legal.terms} />
}
