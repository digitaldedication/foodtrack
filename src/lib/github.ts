export const REPO = 'digitaldedication/foodtrack'

/**
 * Unknown foods are taught to the app by opening a pre-filled GitHub issue.
 * A GitHub Action lets Claude research the product and add it to
 * `public/data/foods-extra.json`; the app picks it up on the next load.
 */
export function newFoodIssueUrl(productText: string): string {
  const title = `Nieuw product: ${productText}`
  const body = [
    `Voeg dit product toe aan de voedingsdatabase van FoodTrack.`,
    ``,
    `**Gesproken tekst:** ${productText}`,
    ``,
    `_Aangemaakt vanuit de FoodTrack-app._`
  ].join('\n')
  const params = new URLSearchParams({ title, body, labels: 'food-request' })
  return `https://github.com/${REPO}/issues/new?${params.toString()}`
}
