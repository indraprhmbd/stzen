import { useCopy } from '../../hooks/useCopy'
import LegalDoc from './LegalDoc'

export default function Privacy() {
  const { t } = useCopy()
  return <LegalDoc doc={t.legal.privacy} />
}
