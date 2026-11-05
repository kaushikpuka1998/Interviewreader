// frontend/src/constants/RoleImages.js

/**
 * A mapping of role slugs to their image URLs.
 * Keys should match the slug used in the tracks data structure (e.g., 'java', 'frontend').
 */
export const ROLE_IMAGES = {
  'java-backend': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRkgX6fIbqgD_lViv79-us1Ql_b07OBA50vbssa7qSZe-g3RBBVdSSIydI',
  'frontend': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQPBcOurJOS8G92DKcjXf3egpKvJelpZDNtJFHKFZOlmw&s=10',
  'full-stack': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTswCU3Wl4Lnv3FTz0UZLaCScuTrwyoy0P82m4aWxEHag&s=10',
  'rails-backend': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSPjFNO_CzkHkYdP26YcaqVdgLsw5T8elUidtc7-t46_g&s=10',
  'go-backend': 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRpVBnBdFNpQJnrRfSOiPc8beYgVH-NJBwFtlkLdXLYzbifIzDKKWxYB14&s=10'
}

/**
 * Gets the icon URL for a given role slug.
 * @param {string} slug - The slug of the role (e.g., 'java').
 * @returns {string} The image URL, or a default fallback.
 */
export const getRoleIconUrl = (slug) => {
  console.log("SLUG"+slug);
  return ROLE_IMAGES[slug] || 'https://cdn-icons-png.flaticon.com/512/6213/6213731.png'; // Fallback icon
}
