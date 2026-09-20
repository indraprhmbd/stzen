import { useCopy } from '../../hooks/useCopy'
import LegalDoc from './LegalDoc'

export default function Refunds() {
  const { t } = useCopy()
  return <LegalDoc doc={t.legal.refunds} />
}
