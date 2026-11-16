// ROAD TRIP ANTHEMS: the original soundtrack tracks on Spotify (each ID
// verified against Spotify's oEmbed and the label's own album page).
// Played through Spotify's official embedded player with album covers.

// other spellings people use in file names
const ALIASES = {
  'Khwabon Ke Parindey': ['Khaabon Ke Parinday', 'Khwabon Ke Parinde', 'Khaabon Ke Parindey'],
  'Sooraj Ki Baahon Mein': ['Sooraj Ki Bahon Mein', 'Suraj Ki Baahon Mein'],
  'Aao Milo Chalo': ['Aao Milo Chalen', 'Aao Milo Chale'],
  'Yun Hi Chala Chal': ['Yunhi Chala Chal', 'Yuhi Chala Chal'],
  'Zindagi Ek Safar Hai Suhana': ['Zindagi Ek Safar'],
}

const ART = (id) => `https://image-cdn-ak.spotifycdn.com/image/${id}`

const RAW = [
  ['Ilahi', 'Yeh Jawaani Hai Deewani', 2013, 'Arijit Singh · Pritam', '5cgKosPPj5Cs9a2JQufUc1', 'ab67616d00001e02707ea5b8023ac77d31756ed4'],
  ['Zinda', 'Bhaag Milkha Bhaag', 2013, 'Siddharth Mahadevan · Shankar–Ehsaan–Loy', '7vZz8oJ5qAqB9MghufRK5k', 'ab67616d00001e02b414911b2d52d2601220603a'],
  ['Safarnama', 'Tamasha', 2015, 'Lucky Ali · A. R. Rahman', '6w458kA8WOAIZr1ublxnK9', 'ab67616d00001e02da50894e074ecd5ce61de0a1'],
  ['Phir Se Ud Chala', 'Rockstar', 2011, 'Mohit Chauhan · A. R. Rahman', '1kcV2LJxt5v0s2cEGtEJ5i', 'ab67616d00001e0254e544672baa16145d67612b'],
  ['Kun Faya Kun', 'Rockstar', 2011, 'A. R. Rahman · Javed Ali · Mohit Chauhan', '7F8RNvTQlvbeBLeenycvN6', 'ab67616d00001e0254e544672baa16145d67612b'],
  ['Patakha Guddi', 'Highway', 2014, 'Sultana & Jyoti Nooran · A. R. Rahman', '7jpmNt5iCtSdXuT1xEGp8O', 'ab67616d00001e021f4e9ecaf6913e207810093f'],
  ['Zindagi Ek Safar Hai Suhana', 'Andaz', 1971, 'Kishore Kumar · Shankar–Jaikishan', '6pFkZQ3o224K3dAR16oWAj', 'ab67616d00001e02d5839b701ba214a45a28a2f7'],
  ['Dil Chahta Hai', 'Dil Chahta Hai', 2001, 'Shankar Mahadevan · Shankar–Ehsaan–Loy', '2r1CHpKRDdzHGJScn5UqjX', 'ab67616d00001e025da5e18b4f9a33d42e737c21'],
  ['Aao Milo Chalo', 'Jab We Met', 2007, 'Shaan · Ustad Sultan Khan · Pritam', '6ocOeSjnWPcSTaSsi0zIdY', 'ab67616d00001e0252fe6875028c892308ffc2f7'],
  ['Matargashti', 'Tamasha', 2015, 'Mohit Chauhan · A. R. Rahman', '5GeBgck1MU2tlIkMpsn8uT', 'ab67616d00001e02da50894e074ecd5ce61de0a1'],
  ['Yun Hi Chala Chal', 'Swades', 2004, 'Udit Narayan · Kailash Kher · Hariharan', '3GrTI5vAoDD3VE24VTBJAc', 'ab67616d00001e02e63c0ab993ae23b9efa3fe27'],
  ['Khwabon Ke Parindey', 'Zindagi Na Milegi Dobara', 2011, 'Mohit Chauhan · Alyssa Mendonsa', '14eotumM24MhIgzidgN3Jx', 'ab67616d00001e020acb5a72549287bf33b51b71'],
  ['Journey Song', 'Piku', 2015, 'Anupam Roy · Shreya Ghoshal', '3YCQF1AzAu54fHqVOQwnqh', 'ab67616d00001e02a17f344de5c4970172bc0579'],
  ['Sooraj Ki Baahon Mein', 'Zindagi Na Milegi Dobara', 2011, 'Loy Mendonsa · Dominique Cerejo', '723xQva0yBF7M6K3nDAG8R', 'ab67616d00001e020acb5a72549287bf33b51b71'],
  ['Hairat', 'Anjaana Anjaani', 2010, 'Lucky Ali · Vishal–Shekhar', '6512hyAQxOng8v4R71IV47', 'ab67616d00001e021da0a37c5bad81580d49ef05'],
]

export const PLAYLIST = RAW.map(([title, film, year, artists, spotify, art], i) => ({
  n: i + 1,
  num: String(i + 1).padStart(2, '0'),
  title,
  film,
  year,
  artists,
  spotify,
  art: ART(art),
  aliases: ALIASES[title] ?? [],
}))

export const PLAYLIST_NAME = 'Road Trip Anthems'
