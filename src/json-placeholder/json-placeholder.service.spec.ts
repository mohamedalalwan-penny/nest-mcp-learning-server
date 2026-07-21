import { JsonPlaceholderService, type Post } from './json-placeholder.service';

describe('JsonPlaceholderService', () => {
  const service = new JsonPlaceholderService();

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('filters by user and caps the returned list', async () => {
    const posts: Post[] = Array.from({ length: 5 }, (_, index) => ({
      userId: 2,
      id: index + 1,
      title: `Post ${index + 1}`,
      body: 'Body',
    }));
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(posts), { status: 200 }));

    const result = await service.listPosts(2, 3);

    expect(result).toHaveLength(3);
    const [calledUrl, calledOptions] = fetchMock.mock.calls[0];
    expect(calledUrl).toEqual(
      new URL('https://jsonplaceholder.typicode.com/posts?userId=2'),
    );
    expect(calledOptions?.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns a safe failure instead of leaking upstream details', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('upstream secret', { status: 503 }));

    await expect(service.getPost(1)).rejects.toThrow(
      'JSONPlaceholder request failed',
    );
  });

  it('projects a user to the fields declared by the MCP output schema', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          name: 'Test User',
          username: 'tester',
          email: 'test@example.com',
          phone: '123',
          website: 'example.com',
          address: { city: 'Leanneburgh' },
          company: { name: 'Romaguera-Crona' },
        }),
        { status: 200 },
      ),
    );

    await expect(service.getUser(1)).resolves.toEqual({
      id: 1,
      name: 'Test User',
      username: 'tester',
      email: 'test@example.com',
      phone: '123',
      website: 'example.com',
    });
  });
});
